import GraphQLJSON, {GraphQLJSONObject} from "graphql-type-json";
import {Currency} from "../db/model/Currency";
import {generate, IAccount, IColumn, IJoin, IOptions, ISort} from "@slotify/shared/lib/graphQLApi";
import {Wager} from "../db/model/Wager";
import {Round} from "../db/model/Round";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {invalidate} from "@slotify/shared/lib/cache";
import * as fs from "fs";
import gameVerifier from "../route/gameVerifier";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import Exception from "@slotify/shared/lib/Exception";
import {importCsv} from "@slotify/shared/lib/importCSV";
import {CriticalFile} from "../db/model/CriticalFile";
import {CriticalFileVerification} from "../db/model/CriticalFileVerification";
import {loadFileChecksum} from "../compliance/critical-files/files";
import {verifyCriticalFile, verifyCriticalFiles} from "../compliance/critical-files/verification";
import {RtpMonitoring} from "../db/model/RtpMonitoring";
import {addRtpMonitoring, editRtpMonitoring} from "../compliance/rtp/rtpResolvers";
import {Room} from "../db/model/Room";
import {Command} from "../db/model/Command";
import {getAvailableBets, getBetsBulk} from "../util/betUtil";
import {DrawWin} from "../db/model/DrawWin";
import {getGames} from "../util/gamesUtil";
import {redis} from "@slotify/shared/lib/redis";
import {Draw} from "../db/model/Draw";
import {autoCompleteRound} from "../route/autoCompleteRound";
import {generateHashChain, setRngSeed} from "../util/provablyFairMultiplayerUtil";
import {SelectQueryBuilder} from "typeorm";
import {getCurrencies} from "../util/adapterUtil";
import {getInTimezone, getPreviousDayInTimezone} from "@slotify/shared/lib/time";
import {payDrawWin} from "../multiplayer/tick";

interface IContext {
    account: IAccount;
}

function getSelectValuesQuery(data: any[]): (queryBuilder: SelectQueryBuilder<any>) => SelectQueryBuilder<any> {
    return queryBuilder => {
        if (data.length === 0) return queryBuilder;

        const fields = Object.keys(data[0]);
        const select = fields.map((field, i) => `column${i + 1} as ${field}`).join(", ");
        const values = data.map(item => `(${fields.map(field => (typeof item[field] === "number" ? item[field] : `'${item[field]}'`)).join(", ")})`);
        return queryBuilder.select(select).from(`(VALUES ${values})`, "temp");
    };
}

function validateSubList(list: Set<string>, subList: string[] | undefined, fieldName: string) {
    if (list.size !== 0 && subList && (subList.length === 0 || subList.some(value => !list.has(value)))) {
        throw new Exception(`${fieldName} needs to be specified and each of them needs to be from: ${[...list].join(",")}`);
    }
}

function validateSettingsSet(settings: Settings, account: IAccount) {
    validateSubList(new Set(account.providers), settings.providers, "Provider");
    validateSubList(new Set(account.wallets), settings.wallets, "Wallet");
    validateSubList(new Set(account.operators), settings.operators, "Operator");
    validateSubList(new Set(account.brands), settings.brands, "Brand");
}

function validateSettings({wallet, operator, brand, provider}: Partial<ISettingsFilter>, account: IAccount) {
    if (account.wallets && (!wallet || !account.wallets.includes(wallet))) throw new Exception(`You need to specify wallet ${wallet}`);
    if (account.operators && (!operator || !account.operators.includes(operator))) throw new Exception(`You need to specify operator ${operator}`);
    if (account.brands && (!brand || !account.brands.includes(brand))) throw new Exception(`You need to specify brand ${brand}`);
    if (account.providers && (!provider || !account.providers.includes(provider))) throw new Exception(`You need to specify provider ${provider}`);
}

export default {
    JSON: GraphQLJSON,
    JSONObject: GraphQLJSONObject,
    Query: {
        async schema() {
            return fs.readFileSync(process.cwd() + "/graphql/schema.graphql").toString();
        },
        async fixedCurrencyRates(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            const columns: IColumn[] = [
                {alias: "currency", sql: "currency.currency", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
                {alias: "fixedRate", sql: "currency.fixedRate", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "symbol", sql: "currency.symbol", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
                {alias: "decimals", sql: "currency.decimals", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
                {alias: "exchangeRate", sql: '"exchangeRate".rate'},
                {alias: "exchangeRateDiff", sql: 'currency."fixedRate" / NULLIF("exchangeRate".rate, 0) - 1'},
            ];

            const currencies = await getCurrencies();
            const joins = [
                {
                    entity: getSelectValuesQuery(currencies),
                    alias: "exchangeRate",
                    condition: 'currency.currency = "exchangeRate".currency',
                },
            ];
            return generate(Currency, "currency", joins, columns, sort, filter, Math.min(limit, 10000), offset);
        },
        async wagers(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            if (!filter?.find(f => f.field === "roundId")) throw new Exception("This query requires a 'roundId' filter");

            const columns: IColumn[] = [
                {alias: "roundId", sql: "wager.roundId", filters: ["EQUAL"], type: "uuid"},
                {alias: "createdAt", sql: "wager.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "bet", sql: "wager.bet", filters: ["EQUAL"]},
                {alias: "win", sql: "wager.win", filters: ["EQUAL"]},
                {alias: "action", sql: "wager.action", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
                {alias: "next", sql: "wager.next", filters: ["NULL", "NOT_NULL"]},
                {alias: "data", sql: "wager.data", filters: ["NULL", "NOT_NULL"]},
                {alias: "state", sql: "wager.state", filters: ["NULL", "NOT_NULL"]},
                {alias: "params", sql: "wager.params", filters: ["NULL", "NOT_NULL"]},
                {alias: "promo", sql: "wager.promo", filters: ["NULL", "NOT_NULL"]},
                {alias: "auto", sql: "wager.auto", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
            ];
            return generate(Wager, "wager", [], columns, sort, filter, Math.min(limit, 100), offset);
        },
        async rounds(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            if (!filter?.find(f => f.field === "roundId") && !filter?.find(f => f.field === "playerId")) throw new Exception("This query requires a 'roundId' or 'playerId' filter");

            const columns: IColumn[] = [
                {alias: "roundId", sql: "round.roundId", filters: ["EQUAL"], type: "uuid"},
                {alias: "createdAt", sql: "round.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "playerId", sql: "round.playerId", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
                {alias: "status", sql: "round.status", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
                {alias: "game", sql: "round.game", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
                {alias: "variant", sql: "round.variant", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
            ];
            return generate(Round, "round", [], columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async DGE_pendingRounds(_: any, {sort, filter = [], options, limit = 10000, offset}: IOptions, account: IAccount) {
            const columns: IColumn[] = [
                {alias: "roundId", sql: "round.roundId", filters: ["EQUAL"], type: "uuid", group: true},
                {alias: "createdAt", sql: "round.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"], group: true},
                {alias: "playerId", sql: "round.playerId", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"], group: true},
                {alias: "status", sql: "round.status", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "game", sql: "round.game", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"], group: true},
                {alias: "variant", sql: "round.variant", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"], group: true},

                {alias: "wallet", sql: "player.wallet", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "operator", sql: "player.operator", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "brand", sql: "player.brand", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "currency", sql: "player.currency", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},

                {alias: "win", sql: "SUM(wager.win)", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
                {alias: "bet", sql: "SUM(wager.bet)", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
            ];

            if (options?.timestamp) {
                const {end} = getPreviousDayInTimezone(options.timestamp, "America/New_York");
                filter.push({field: "createdAt", type: "LOWER_OR_EQUAL", value: end});
            }

            account.wallets && filter.push({field: "wallet", type: "IN", value: account.wallets});
            account.operators && filter.push({field: "operator", type: "IN", value: account.operators});
            account.brands && filter.push({field: "brand", type: "IN", value: account.brands});

            options?.wallet && filter.push({field: "wallet", type: "EQUAL", value: options.wallet});
            filter.push({field: "status", type: "IN", value: ["started", "finishing", "unpaid", "failed"]});

            const joins: IJoin[] = [
                {entity: "adapter_player", alias: "player", condition: "player.id = round.playerId"}, //warning: this is joining with a table from adapter service
                {entity: Wager, alias: "wager", condition: "wager.roundId = round.roundId"},
            ];
            const result = await generate(Round, "round", joins, columns, sort, filter, Math.min(limit, 10000), offset);
            result.items = result.items.map(item => ({...item, createdAt: getInTimezone(item.createdAt.getTime(), "America/New_York").toISO()}));
            return result;
        },
        async DGE_cancelledRounds(_: any, {sort, filter = [], options, limit, offset}: IOptions, account: IAccount) {
            const columns: IColumn[] = [
                {alias: "roundId", sql: "round.roundId", filters: ["EQUAL"], type: "uuid", group: true},
                {alias: "createdAt", sql: "round.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"], group: true},
                {alias: "failedAt", sql: "round.failedAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"], group: true},
                {alias: "failReason", sql: "round.failReason", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "playerId", sql: "round.playerId", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"], group: true},
                {alias: "status", sql: "round.status", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "game", sql: "round.game", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"], group: true},
                {alias: "variant", sql: "round.variant", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"], group: true},

                {alias: "wallet", sql: "player.wallet", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "operator", sql: "player.operator", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "brand", sql: "player.brand", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},
                {alias: "currency", sql: "player.currency", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "IN"], group: true},

                {alias: "win", sql: "SUM(wager.win)", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
                {alias: "bet", sql: "SUM(wager.bet)", filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
            ];

            if (options?.timestamp) {
                const {start, end} = getPreviousDayInTimezone(options.timestamp, "America/New_York");
                filter.push({field: "createdAt", type: "GREATER_OR_EQUAL", value: start});
                filter.push({field: "createdAt", type: "LOWER_OR_EQUAL", value: end});
            }

            account.wallets && filter.push({field: "wallet", type: "IN", value: account.wallets});
            account.operators && filter.push({field: "operator", type: "IN", value: account.operators});
            account.brands && filter.push({field: "brand", type: "IN", value: account.brands});

            options?.wallet && filter.push({field: "wallet", type: "EQUAL", value: options.wallet});
            filter.push({field: "status", type: "EQUAL", value: "cancelled"});

            const joins: IJoin[] = [
                {entity: "adapter_player", alias: "player", condition: "player.id = round.playerId"}, //warning: this is joining with a table from adapter service
                {entity: Wager, alias: "wager", condition: "wager.roundId = round.roundId"},
            ];
            const result = await generate(Round, "round", joins, columns, sort, filter, limit, offset);
            result.items = result.items.map(item => ({...item, createdAt: getInTimezone(item.createdAt.getTime(), "America/New_York").toISO()}));
            return result;
        },
        async settings(_: any, {sort, filter = [], limit = 10, offset}: IOptions, {account}: IContext) {
            const columns: IColumn[] = [
                {alias: "id", sql: "setting.id", filters: ["EQUAL"]},
                {alias: "settingId", sql: "setting.settingId", filters: ["EQUAL"], type: "uuid"},
                {alias: "wallets", sql: "setting.wallets", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "operators", sql: "setting.operators", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "brands", sql: "setting.brands", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "providers", sql: "setting.providers", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "games", sql: "setting.games", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "jurisdictions", sql: "setting.jurisdictions", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "currencies", sql: "setting.currencies", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "key", sql: "setting.key", filters: ["EQUAL", "NOT_EQUAL", "LIKE", "IN"]},
                {alias: "value", sql: "setting.value", filters: ["EQUAL", "NOT_EQUAL", "LIKE", "IN"]},
                {alias: "priority", sql: "setting.priority", filters: ["EQUAL", "NOT_EQUAL", "LIKE", "IN", "GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "comment", sql: "setting.comment", filters: ["LIKE"]},
                {alias: "serverOnly", sql: "setting.serverOnly", filters: ["EQUAL", "NOT_EQUAL"]},
            ];
            const defaultSort: ISort = {field: "priority", order: "DESC"};

            account.wallets && filter.push({field: "wallets", type: "CONTAIN", value: account.wallets});
            account.operators && filter.push({field: "operators", type: "CONTAIN", value: account.operators});
            account.brands && filter.push({field: "brands", type: "CONTAIN", value: account.brands});
            account.providers && filter.push({field: "providers", type: "CONTAIN", value: account.providers});

            return generate(Settings, "setting", [], columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
        },
        async rooms(_: any, {sort, filter = [], limit = 10, offset}: IOptions, {account}: IContext) {
            const columns: IColumn[] = [
                {alias: "roomId", sql: "room.roomId", filters: ["EQUAL"]},
                {alias: "createdAt", sql: "room.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "updatedAt", sql: "room.updatedAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "name", sql: "room.name", filters: ["EQUAL", "LIKE", "NOT_EQUAL"]},
                {alias: "provider", sql: "room.provider", filters: ["IN", "EQUAL", "LIKE", "NOT_EQUAL"]},
                {alias: "game", sql: "room.game", filters: ["EQUAL", "LIKE", "NOT_EQUAL"]},
                {alias: "config", sql: "room.config", filters: [], type: "json"},
                {alias: "provablyFair", sql: "room.provablyFair", filters: [], type: "json"},
                {alias: "enabled", sql: "room.enabled", filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "minBet", sql: "room.minBet", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "maxBet", sql: "room.maxBet", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "secretKey", sql: "room.secretKey", filters: ["EQUAL", "LIKE", "NOT_EQUAL"]},
                {alias: "currencies", sql: "room.currencies", filters: ["LIKE"], type: "json"},
                {alias: "wallets", sql: "room.wallets", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "operators", sql: "room.operators", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "brands", sql: "room.brands", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "variant", sql: "room.variant", filters: ["IN", "EQUAL", "LIKE", "NOT_EQUAL"]},
                {alias: "ips", sql: "room.ips", filters: ["CONTAIN", "LIKE"], type: "json"},
            ];
            const defaultSort: ISort = {field: "createdAt", order: "DESC"};

            account.wallets && filter.push({field: "wallets", type: "CONTAIN", value: account.wallets});
            account.operators && filter.push({field: "operators", type: "CONTAIN", value: account.operators});
            account.brands && filter.push({field: "brands", type: "CONTAIN", value: account.brands});
            account.providers && filter.push({field: "provider", type: "IN", value: account.providers});

            return generate(Room, "room", [], columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
        },
        async checkSettings(_: any, {wallet, operator, brand, provider, game, jurisdiction, currency}: any, {account}: IContext) {
            validateSettings({wallet, operator, brand, provider}, account);
            return {settings: (await Settings.getValues({game, brand, jurisdiction, wallet, provider, operator, currency})) || {}};
        },
        async availableBets(_: any, {wallet, operator, brand, provider, game, jurisdiction, currency, roomId}: any, {account}: IContext) {
            validateSettings({wallet, operator, brand, provider}, account);
            return {bets: await getAvailableBets(provider, game, currency, wallet, operator, brand, jurisdiction, roomId)};
        },
        async availableBetsBulk(_: any, {wallet, operator, brand, provider, games, jurisdiction, currencies}: any, {account}: IContext) {
            validateSettings({wallet, operator, brand, provider}, account);
            return {bets: await getBetsBulk(provider, games, currencies, wallet, operator, brand, jurisdiction)};
        },
        async gameList(_: any, params: any, {account}: IContext) {
            const {providers} = await getGames();
            const filteredProviders = await this.providerList(_, params, {account});
            const games: string[] = [];
            for (const provider of filteredProviders) {
                games.push(...providers[provider]);
            }
            return [...new Set(games)].sort();
        },
        async providerList(_: any, params: any, {account}: IContext) {
            const {providers} = await getGames();
            return Object.keys(providers)
                .filter(provider => !account.providers || account.providers.includes(provider))
                .sort();
        },
        async currencyList() {
            return (await Currency.find()).map(item => item.currency).sort();
        },
        async criticalFiles(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            const columns: IColumn[] = [
                {alias: "id", sql: "critical_file.id", filters: ["EQUAL", "LIKE"]},
                {alias: "name", sql: "critical_file.name", filters: ["EQUAL", "LIKE"]},
                {alias: "component", sql: "critical_file.component", filters: ["EQUAL", "LIKE", "IN"]},
                {alias: "service", sql: "critical_file.service", filters: ["EQUAL", "LIKE"]},
                {alias: "path", sql: "critical_file.path", filters: ["EQUAL", "LIKE"]},
                {alias: "origin", sql: "critical_file.origin", filters: ["EQUAL", "LIKE"]},
                {alias: "declaredChecksum", sql: "critical_file.declaredChecksum", filters: ["EQUAL", "LIKE"]},
                {alias: "loggedChecksum", sql: "critical_file.loggedChecksum", filters: ["EQUAL", "LIKE"]},
                {alias: "jurisdictions", sql: "critical_file.jurisdictions", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "blockOnError", sql: "critical_file.blockOnError", filters: ["EQUAL", "LIKE"]},
                {alias: "comment", sql: "critical_file.comment", filters: ["EQUAL", "LIKE"]},
                {alias: "createdAt", sql: "critical_file.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "updatedAt", sql: "critical_file.updatedAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
            ];
            return generate(CriticalFile, "critical_file", [], columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async criticalFilesVerification(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            const columns: IColumn[] = [
                {alias: "id", sql: "critical_file_verification.id", filters: ["EQUAL", "LIKE"]},
                {alias: "createdAt", sql: "critical_file_verification.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "fileId", sql: "critical_file_verification.fileId", filters: ["EQUAL", "LIKE"]},
                {alias: "loggedChecksum", sql: "critical_file_verification.loggedChecksum", filters: ["EQUAL", "LIKE"]},
                {alias: "declaredChecksum", sql: "critical_file_verification.declaredChecksum", filters: ["EQUAL", "LIKE"]},
                {alias: "success", sql: "critical_file_verification.loggedChecksum = critical_file_verification.declaredChecksum", filters: ["EQUAL", "LIKE", "IN"]},
                {alias: "name", sql: "critical_file.name", join: "critical_file", filters: ["EQUAL", "LIKE"]},
                {alias: "component", sql: "critical_file.component", join: "critical_file", filters: ["EQUAL", "LIKE"]},
            ];
            const joins: IJoin[] = [{entity: CriticalFile, alias: "critical_file", condition: "critical_file.id = critical_file_verification.fileId"}];
            return generate(CriticalFileVerification, "critical_file_verification", joins, columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async rtpMonitoring(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            const columns: IColumn[] = [
                {alias: "id", sql: "rtp_monitoring.id", filters: ["EQUAL", "LIKE"]},
                {alias: "createdAt", sql: "rtp_monitoring.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "updatedAt", sql: "rtp_monitoring.updatedAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "game", sql: "rtp_monitoring.game", filters: ["EQUAL", "LIKE"]},
                {alias: "variant", sql: "rtp_monitoring.variant", filters: ["EQUAL", "LIKE", "IN"]},
                {alias: "declaredRtp", sql: "rtp_monitoring.declaredRtp", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "sampleCount", sql: "rtp_monitoring.sampleCount", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "sampleRtp", sql: "rtp_monitoring.sampleRtp", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "sampleVariance", sql: "rtp_monitoring.sampleVariance", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "sampleMarginOfError", sql: "rtp_monitoring.sampleMarginOfError", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
            ];
            return generate(RtpMonitoring, "rtp_monitoring", [], columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async draws(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            if (!filter?.find(f => f.field === "drawId")) throw new Exception("This query requires a 'drawId' filter");

            const columns: IColumn[] = [
                {alias: "id", sql: "draw.id", filters: ["EQUAL", "LIKE"]},
                {alias: "createdAt", sql: "draw.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "roomId", sql: "draw.roomId", filters: ["EQUAL", "LIKE"]},
                {alias: "drawId", sql: "draw.drawId", filters: ["EQUAL", "LIKE"]},
                {alias: "finished", sql: "draw.finished", filters: ["EQUAL", "LIKE"]},
                {alias: "state", sql: "draw.state", filters: ["LIKE"]},
                {alias: "nextTickTime", sql: "draw.nextTickTime", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
            ];
            return generate(Draw, "draw", [], columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async commands(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            if (!filter?.find(f => f.field === "drawId" || f.field === "roundId")) throw new Exception("This query requires a 'drawId' or 'roundId' filter");

            const columns: IColumn[] = [
                {alias: "commandId", sql: "command.commandId", filters: ["EQUAL"]},
                {alias: "roundId", sql: "command.roundId", filters: ["EQUAL"], type: "uuid"},
                {alias: "createdAt", sql: "command.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "roomId", sql: "command.roomId", filters: ["EQUAL"]},
                {alias: "tickId", sql: "command.tickId", filters: ["EQUAL"]},
                {alias: "playerId", sql: "command.playerId", filters: ["EQUAL"]},
                {alias: "drawId", sql: "command.drawId", filters: ["EQUAL"]},
                {alias: "time", sql: "command.time", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "action", sql: "command.action", filters: ["EQUAL", "LIKE"]},
                {alias: "bet", sql: "command.bet", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "currency", sql: "command.currency", filters: ["EQUAL", "LIKE"]},
                {alias: "params", sql: "command.params", filters: ["LIKE"]},
                {alias: "withdrawalStatus", sql: "command.withdrawalStatus", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
            ];

            return generate(Command, "command", [], columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async drawWins(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            if (!filter?.find(f => f.field === "drawId" || f.field === "roundId")) throw new Exception("This query requires a 'drawId' or 'roundId' filter");
            const columns: IColumn[] = [
                {alias: "drawWinId", sql: "drawWin.drawWinId", filters: ["EQUAL"]},
                {alias: "createdAt", sql: "drawWin.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "playerId", sql: "drawWin.playerId", filters: ["EQUAL"]},
                {alias: "roundId", sql: "drawWin.roundId", filters: ["EQUAL"]},
                {alias: "tickId", sql: "drawWin.tickId", filters: ["EQUAL"]},
                {alias: "amount", sql: "drawWin.amount", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "status", sql: "drawWin.status", filters: ["EQUAL", "LIKE", "IN"]},
                {alias: "drawId", sql: "drawWin.drawId", filters: ["EQUAL", "LIKE", "IN"]},
            ];

            return generate(DrawWin, "drawWin", [], columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async availableCurrencies() {
            const exchangeRates = await getCurrencies();
            const fixedRates = await Currency.getFixedRates();
            const currencies: {currency: string}[] = [];
            for (const {currency} of fixedRates) {
                if (exchangeRates.find(f => f.currency === currency)) {
                    currencies.push({currency});
                }
            }
            return currencies;
        },
    },
    Mutation: {
        async addFixedCurrencyRate(_: any, {data}: any) {
            if (await Currency.findOneBy({currency: data.currency})) {
                throw new Exception("Item already exists");
            }
            Currency.validate(data);
            await Currency.save(Currency.create(data));
            invalidate("currency");
            return data.currency;
        },
        async editFixedCurrencyRate(_: any, {currency, data}: any) {
            if (currency !== data.currency && (await Currency.findOneBy({currency: data.currency}))) {
                throw new Exception("Item already exists");
            }
            Currency.validate(data);
            await Currency.update({currency}, data);
            invalidate("currency");
            return true;
        },
        async deleteFixedCurrencyRate(_: any, {currency}: any) {
            await Currency.delete({currency});
            invalidate("currency");
            return true;
        },
        async addSetting(_: any, {data}: {data: Settings}, {account}: IContext) {
            validateSettingsSet(data, account);
            const {id} = await Settings.save(Settings.create(data));
            invalidate("settings");
            return id;
        },
        async editSetting(_: any, {id, data}: {id: number; data: Settings}, {account}: IContext) {
            validateSettingsSet(data, account);
            await Settings.update({id}, data);
            invalidate("settings");
            return true;
        },
        async deleteSetting(_: any, {id}: {id: number}, {account}: IContext) {
            const data = await Settings.findOneBy({id});
            if (!data) {
                throw new Exception("Settings does not exist");
            }
            validateSettingsSet(data, account);
            await Settings.delete({id});
            invalidate("settings");
            return true;
        },
        async addRoom(_: any, {data}: {data: Partial<Room>}) {
            const room = (await Room.save(Room.create(data))) as Room;
            invalidate("rooms");

            if (room.provablyFair) {
                try {
                    const {chainLength} = room.provablyFair;
                    await generateHashChain(room.roomId, chainLength);
                } catch (error) {
                    throw new Exception("Provably fair hash chain generation malfunction", {data: {room, error}});
                }
            } else {
                await redis.publish("roomAdded", "");
            }
            return room.roomId;
        },
        async editRoom(_: any, {roomId, data}: {roomId: string; data: Partial<Room>}) {
            const {game, provider, provablyFair, ...strippedData} = data;
            await Room.update({roomId}, strippedData);
            invalidate("rooms");
            return true;
        },
        async setRoomRngSeed(_: any, {roomId, seed}: {roomId: string; seed: string}) {
            const provablyFair = await setRngSeed(roomId, seed);
            await Room.update({roomId}, {provablyFair});
            invalidate("rooms");
            await redis.publish("roomAdded", "");
            return true;
        },
        async deleteRoom(_: any, {roomId}: {roomId: string}) {
            const room = await Room.findOneByOrFail({roomId});
            await room.softRemove();
            invalidate("rooms");
            return true;
        },
        async importSettings(_: any, {data}: {data: string}, {account}: IContext) {
            return await importCsv(
                Settings,
                "settingId",
                data,
                {
                    settingId: value => value,
                    games: value => (value !== "" ? value.split(",") : undefined),
                    providers: value => (value !== "" ? value.split(",") : undefined),
                    wallets: value => (value !== "" ? value.split(",") : undefined),
                    operators: value => (value !== "" ? value.split(",") : undefined),
                    brands: value => (value !== "" ? value.split(",") : undefined),
                    jurisdictions: value => (value !== "" ? value.split(",") : undefined),
                    currencies: value => (value !== "" ? value.split(",") : undefined),
                    key: value => value,
                    value: value => value,
                    priority: value => parseInt(value, 10),
                    serverOnly: value => value === "true",
                    comment: value => value,
                },
                data => this.addSetting(null, {data}, {account}),
                data => this.editSetting(null, {id: data.id, data}, {account}),
            );
        },
        async importRooms(_: any, {data}: {data: string}) {
            return await importCsv(
                Room,
                "roomId",
                data,
                {
                    roomId: value => value,
                    game: value => value,
                    provider: value => value,
                    enabled: value => value === "true",
                    minBet: value => parseFloat(value),
                    maxBet: value => parseFloat(value),
                    config: value => value && JSON.parse(value),
                    provablyFair: value => value && JSON.parse(value),
                    currencies: value => (value !== "" ? value.split(",") : undefined),
                    wallets: value => (value !== "" ? value.split(",") : undefined),
                    operators: value => (value !== "" ? value.split(",") : undefined),
                    brands: value => (value !== "" ? value.split(",") : undefined),
                    name: value => value,
                    variant: value => value,
                },
                data => this.addRoom(null, {data}),
                data => this.editRoom(null, {roomId: data.roomId, data}),
            );
        },
        async importFixedCurrencyRates(_: any, {data}: {data: string}) {
            return await importCsv(
                Currency,
                "currency",
                data,
                {
                    currency: value => value,
                    fixedRate: value => parseFloat(value),
                    decimals: value => parseInt(value, 10),
                    symbol: value => value,
                },
                data => this.addFixedCurrencyRate(null, {data}),
                data => this.editFixedCurrencyRate(null, {currency: data.currency, data}),
            );
        },
        async gameVerifier(_: any, {provider, game, variant, iterations, action, bet, params, criticalFilePath}: any) {
            if (!isDevMode()) throw new Exception("Verifier is supposed to be used on on non-production environments");
            if (iterations > 1000) throw new Exception("Maximum number of iterations is 1000");
            return await gameVerifier(provider, game, variant, iterations, action, bet, params, criticalFilePath);
        },
        async addCriticalFile(_: any, {data}: {data: CriticalFile}) {
            let checksum;
            try {
                checksum = await loadFileChecksum(data);
                const {id} = await CriticalFile.createWithInitialVerification(data, checksum);
                invalidate("criticalFiles");
                return checksum === data.declaredChecksum && id;
            } catch (e) {
                throw new Exception("Unable to load Critical File", {data: {error: e}});
            }
        },
        async editCriticalFile(_: any, {id, data}: {id: number; data: CriticalFile}) {
            let checksum;
            try {
                checksum = await loadFileChecksum(data);
                await CriticalFile.updateWithInitialVerification(id, data, checksum);
            } catch (e) {
                throw new Exception("Unable to load Critical File", {data: {error: e}});
            }
            invalidate("criticalFiles");
            return checksum === data.declaredChecksum;
        },
        async deleteCriticalFile(_: any, {id}: {id: number}) {
            const criticalFile = await CriticalFile.delete({id});
            if (!criticalFile) {
                throw new Exception("Critical File doesn't exist in database");
            }
            invalidate("criticalFiles");
            return true;
        },
        async importCriticalFiles(_: any, {data}: {data: string}) {
            return await importCsv(
                CriticalFile,
                "name",
                data,
                {
                    name: value => value,
                    component: value => value,
                    origin: value => value,
                    service: value => value,
                    path: value => value,
                    declaredChecksum: value => value,
                    jurisdictions: value => (value !== "" ? value.split(",") : undefined),
                    blockOnError: value => value === "true",
                    comment: value => value,
                },
                async data => await this.addCriticalFile(null, {data}),
                async data => {
                    const id = (await CriticalFile.findOneBy({name: data.name}))?.id;
                    if (!id) {
                        throw new Exception("Critical File not found for editing", {data: {name: data.name}});
                    }
                    return await this.editCriticalFile(null, {id, data});
                },
            );
        },
        async verifyCriticalFile(_: any, {id}: {id: number}) {
            const criticalFile = await CriticalFile.findOneBy({id});
            if (!criticalFile) {
                throw new Exception("Critical File doesn't exist in database");
            }
            await verifyCriticalFile(criticalFile);
            invalidate("criticalFiles");
            return true;
        },
        async verifyCriticalFiles() {
            await verifyCriticalFiles();
            invalidate("criticalFiles");
            return true;
        },
        async addRtpMonitoring(_: any, {data}: {data: RtpMonitoring}) {
            const {id} = await addRtpMonitoring(data);
            return id;
        },
        async editRtpMonitoring(_: any, {id, data}: {id: number; data: RtpMonitoring}) {
            const rtpMonitoring = await RtpMonitoring.findOneBy({id});
            if (!rtpMonitoring) {
                throw new Exception("Rtp Monitoring doesn't exist in database");
            }
            await editRtpMonitoring(rtpMonitoring, data);
            return true;
        },
        async deleteRtpMonitoring(_: any, {id}: {id: number}) {
            const rtpMonitoring = await RtpMonitoring.delete({id});
            if (!rtpMonitoring) {
                throw new Exception("Rtp Monitoring doesn't exist in database");
            }
            return true;
        },
        async importRtpMonitorings(_: any, {data}: {data: string}) {
            return await importCsv(
                RtpMonitoring,
                null,
                data,
                {
                    game: value => value,
                    variant: value => value,
                    declaredRtp: value => parseFloat(value),
                },
                async data => await this.addRtpMonitoring(null, {data}),
                async () => {
                    throw new Exception("Editing no import not present");
                },
            );
        },
        async autoCompleteRound(_: any, {roundId}: {roundId: string}) {
            await autoCompleteRound(roundId);
            return true;
        },
        async payDrawWin(_: any, {drawWinId}: {drawWinId: string}) {
            const drawWin = await DrawWin.findOneByOrFail({drawWinId});
            const draw = await Draw.findOneByOrFail({drawId: drawWin.drawId});
            const room = await Room.findOneByOrFail({roomId: draw.roomId});
            await payDrawWin(drawWin, room, null);
            return true;
        },
    },
};
