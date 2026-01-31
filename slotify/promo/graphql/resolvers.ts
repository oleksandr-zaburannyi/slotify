import GraphQLJSON, {GraphQLJSONObject} from "graphql-type-json";
import {generate, IAccount, IColumn, IJoin, IOptions, ISort} from "@slotify/shared/lib/graphQLApi";
import * as fs from "fs";
import {Campaign} from "../db/model/Campaign";
import {PlayerState} from "../db/model/PlayerState";
import {CampaignState} from "../db/model/CampaignState";
import {CampaignPrize} from "../db/model/CampaignPrize";
import Exception from "@slotify/shared/lib/Exception";
import {getTool} from "../tools/tools";
import {systemEvent} from "../util/routes";
import {CampaignLog} from "../db/model/CampaignLog";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Theme} from "../db/model/Theme";
import {defaultThemes, IDefaultThemes} from "../themes/defaultThemes";
import {importCsv} from "@slotify/shared/lib/importCSV";
import {scheduleCampaignFinish, unscheduleCampaignFinish} from "../util/scheduleTasks";
import {startStream, stopStream} from "../util/streams";
import logger from "@slotify/shared/lib/logger";
import {DGE_jackpot} from "../tools/jackpots/jackpotsReport";
import {baseCurrency, getCurrencies} from "../util/currencyRates";
import exchangePrizeValue from "../util/exchangePrizeValue";
import {round} from "@slotify/shared/lib/round";

interface IContext {
    account: IAccount;
}

function validatePermissions(account: IAccount, campaign: Campaign) {
    if (account.providers && campaign.providers?.length === 0) throw new Exception("Provider needs to be specified");
    if (account.wallets && campaign.wallets?.length === 0) throw new Exception("Wallet needs to be specified");
    if (account.operators && campaign.operators?.length === 0) throw new Exception("Operator needs to be specified");
    if (account.brands && campaign.brands?.length === 0) throw new Exception("Brand needs to be specified");

    if (account.providers && !campaign.providers?.every(provider => account.providers?.includes(provider))) throw new Exception(`Each provider needs to be selected from: ${account.providers?.join(",")}`);
    if (account.wallets && !campaign.wallets?.every(wallet => account.wallets?.includes(wallet))) throw new Exception(`Each wallet needs to be selected from: ${account.wallets?.join(",")}`);
    if (account.operators && !campaign.operators?.every(operator => account.operators?.includes(operator))) throw new Exception(`Each operator needs to be selected from: ${account.operators?.join(",")}`);
    if (account.brands && !campaign.brands?.every(brand => account.brands?.includes(brand))) throw new Exception(`Each brand needs to be selected from: ${account.brands?.join(",")}`);
}

export default {
    JSON: GraphQLJSON,
    JSONObject: GraphQLJSONObject,
    Query: {
        async schema() {
            return fs.readFileSync(process.cwd() + "/graphql/schema.graphql").toString();
        },
        async campaigns(_: any, {sort, filter = [], limit = 10, offset}: IOptions, {account}: IContext) {
            const columns: IColumn[] = [
                {alias: "campaignId", sql: "campaign.campaignId", filters: ["EQUAL"], type: "uuid"},
                {alias: "name", sql: "campaign.name", sort: true, filters: ["EQUAL", "LIKE"]},
                {alias: "walletCampaignId", sql: "campaign.walletCampaignId", filters: ["EQUAL"]},
                {alias: "type", sql: "campaign.type", sort: true, filters: ["EQUAL", "LIKE", "IN"]},
                {alias: "createdAt", sql: "campaign.createdAt", sort: true, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "start", sql: "campaign.start", sort: true, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "end", sql: "campaign.end", sort: true, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "enabled", sql: "campaign.enabled", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {
                    alias: "optIns",
                    sql: '(select count(*) from promo_player_state where "campaign"."campaignId" = "promo_player_state"."campaignId" and "optIn" is true)',
                    sort: true,
                    filters: ["EQUAL", "NOT_EQUAL", "GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"],
                },
                {
                    alias: "optOuts",
                    sql: '(select count(*) from promo_player_state where "campaign"."campaignId" = "promo_player_state"."campaignId" and "optIn" is false)',
                    sort: true,
                    filters: ["EQUAL", "NOT_EQUAL", "GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"],
                },
                {alias: "wallets", sql: "campaign.wallets", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "operators", sql: "campaign.operators", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "brands", sql: "campaign.brands", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "currencies", sql: "campaign.currencies", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "providers", sql: "campaign.providers", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "games", sql: "campaign.games", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "playerIds", sql: "campaign.playerIds", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "nativeIds", sql: "campaign.nativeIds", filters: ["CONTAIN", "LIKE"], type: "json"},
                {alias: "config", sql: "campaign.config"},
                {alias: "state", sql: "campaignState.state"},
                {alias: "themeId", sql: "campaign.themeId", type: "uuid"},
            ];
            const joins: IJoin[] = [{entity: CampaignState, alias: "campaignState", condition: "campaignState.campaignId = campaign.campaignId"}];
            const defaultSort: ISort = {field: "createdAt", order: "DESC"};

            account.wallets && filter.push({field: "wallets", type: "CONTAIN", value: account.wallets});
            account.operators && filter.push({field: "operators", type: "CONTAIN", value: account.operators});
            account.brands && filter.push({field: "brands", type: "CONTAIN", value: account.brands});
            account.providers && filter.push({field: "providers", type: "CONTAIN", value: account.providers});

            return generate(Campaign, "campaign", joins, columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
        },
        async campaignPlayers(_: any, {sort, filter = [], limit = 10, offset}: IOptions, {account}: IContext) {
            const columns: IColumn[] = [
                {alias: "updatedAt", sql: "playerState.updatedAt", sort: true, filters: ["GREATER_OR_EQUAL", "GREATER", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "campaignId", sql: "playerState.campaignId", sort: true, filters: ["EQUAL"]},
                {alias: "playerId", sql: "playerState.playerId", sort: true, filters: ["EQUAL"]},
                {alias: "state", sql: "playerState.state"},
                {alias: "optIn", sql: "playerState.optIn", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "init", sql: "playerState.init", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "finished", sql: "playerState.finished", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "acknowledged", sql: "playerState.acknowledged", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "wallets", sql: "campaign.wallets", filters: ["CONTAIN"]},
                {alias: "operators", sql: "campaign.operators", filters: ["CONTAIN"]},
                {alias: "brands", sql: "campaign.brands", filters: ["CONTAIN"]},
                {alias: "providers", sql: "campaign.providers", filters: ["CONTAIN"]},
                {alias: "games", sql: "campaign.games", filters: ["CONTAIN"]},
            ];
            const joins: IJoin[] = [{entity: Campaign, alias: "campaign", condition: "campaign.campaignId = playerState.campaignId"}];
            const defaultSort: ISort = {field: "updatedAt", order: "DESC"};

            account.wallets && filter.push({field: "wallets", type: "CONTAIN", value: account.wallets});
            account.operators && filter.push({field: "operators", type: "CONTAIN", value: account.operators});
            account.brands && filter.push({field: "brands", type: "CONTAIN", value: account.brands});
            account.providers && filter.push({field: "providers", type: "CONTAIN", value: account.providers});

            return generate(PlayerState, "playerState", joins, columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
        },
        async campaignPrizes(_: any, {sort, filter = [], limit = 10, offset}: IOptions, {account}: IContext) {
            const columns: IColumn[] = [
                {alias: "createdAt", sql: "campaignPrize.createdAt", sort: true, filters: ["GREATER_OR_EQUAL", "GREATER", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "campaignId", sql: "campaignPrize.campaignId", sort: true, filters: ["EQUAL"]},
                {alias: "playerId", sql: "campaignPrize.playerId", sort: true, filters: ["EQUAL"]},
                {alias: "createdAt", sql: "campaignPrize.createdAt", sort: true, filters: ["GREATER_OR_EQUAL", "GREATER", "LOWER", "LOWER_OR_EQUAL", "EQUAL"]},
                {alias: "type", sql: "campaignPrize.type", sort: true, filters: ["EQUAL", "NOT_EQUAL", "LIKE", "IN"]},
                {alias: "data", sql: "campaignPrize.data"},
                {alias: "comment", sql: "campaignPrize.comment"},
                {alias: "paid", sql: "campaignPrize.paid", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "wallets", sql: "campaign.wallets", filters: ["CONTAIN"]},
                {alias: "operators", sql: "campaign.operators", filters: ["CONTAIN"]},
                {alias: "brands", sql: "campaign.brands", filters: ["CONTAIN"]},
                {alias: "providers", sql: "campaign.providers", filters: ["CONTAIN"]},
                {alias: "games", sql: "campaign.games", filters: ["CONTAIN"]},
            ];
            const joins: IJoin[] = [{entity: Campaign, alias: "campaign", condition: "campaign.campaignId = campaignPrize.campaignId"}];
            const defaultSort: ISort = {field: "createdAt", order: "DESC"};

            account.wallets && filter.push({field: "wallets", type: "CONTAIN", value: account.wallets});
            account.operators && filter.push({field: "operators", type: "CONTAIN", value: account.operators});
            account.brands && filter.push({field: "brands", type: "CONTAIN", value: account.brands});
            account.providers && filter.push({field: "providers", type: "CONTAIN", value: account.providers});

            return generate(CampaignPrize, "campaignPrize", joins, columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
        },
        async campaignLogs(_: any, {sort, filter = [], limit = 10, offset}: IOptions, {account}: IContext) {
            const columns: IColumn[] = [
                {alias: "id", sql: "campaignLog.id", sort: true},
                {alias: "createdAt", sql: "campaignLog.createdAt", sort: true, filters: ["GREATER_OR_EQUAL", "GREATER", "LOWER", "LOWER_OR_EQUAL"]},
                {alias: "campaignId", sql: "campaignLog.campaignId", sort: true, filters: ["EQUAL"]},
                {alias: "createdAt", sql: "campaignLog.createdAt", sort: true, filters: ["GREATER_OR_EQUAL", "GREATER", "LOWER", "LOWER_OR_EQUAL", "EQUAL"]},
                {alias: "name", sql: "campaignLog.name", sort: true, filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
                {alias: "data", sql: "campaignLog.data"},
                {alias: "wallets", sql: "campaign.wallets", filters: ["CONTAIN"]},
                {alias: "operators", sql: "campaign.operators", filters: ["CONTAIN"]},
                {alias: "brands", sql: "campaign.brands", filters: ["CONTAIN"]},
                {alias: "providers", sql: "campaign.providers", filters: ["CONTAIN"]},
                {alias: "games", sql: "campaign.games", filters: ["CONTAIN"]},
            ];
            const joins: IJoin[] = [{entity: Campaign, alias: "campaign", condition: "campaign.campaignId = campaignLog.campaignId"}];
            const defaultSort: ISort = {field: "id", order: "DESC"};

            account.wallets && filter.push({field: "wallets", type: "CONTAIN", value: account.wallets});
            account.operators && filter.push({field: "operators", type: "CONTAIN", value: account.operators});
            account.brands && filter.push({field: "brands", type: "CONTAIN", value: account.brands});
            account.providers && filter.push({field: "providers", type: "CONTAIN", value: account.providers});

            return generate(CampaignLog, "campaignLog", joins, columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
        },
        async themes(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            const columns: IColumn[] = [
                {alias: "themeId", sql: "theme.themeId", filters: ["EQUAL"], type: "uuid"},
                {
                    alias: "createdAt",
                    sql: "theme.createdAt",
                    sort: true,
                    filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"],
                },
                {
                    alias: "updatedAt",
                    sql: "theme.updatedAt",
                    sort: true,
                    filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"],
                },
                {alias: "name", sql: "theme.name", sort: true, filters: ["EQUAL", "LIKE"]},
                {alias: "campaignType", sql: "theme.campaignType", sort: true, filters: ["EQUAL", "LIKE", "IN"]},
                {alias: "translations", sql: "theme.translations", type: "json"},
                {alias: "icons", sql: "theme.icons", type: "json"},
            ];
            const defaultSort: ISort = {field: "createdAt", order: "DESC"};
            return generate(Theme, "theme", [], columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
        },
        async defaultThemes(): Promise<IDefaultThemes> {
            return defaultThemes;
        },
        async DGE_jackpot(_: any, {campaignId, timestamp}: {campaignId: string; timestamp: number}) {
            return {items: await DGE_jackpot(campaignId, timestamp)};
        },
        async exchangedPrizeValues(_: any, {baseValue}: {baseValue: number}) {
            if (baseValue <= 0) return [];

            const currencies = await getCurrencies();
            const baseCurrencyData = currencies.find(c => c.currency === baseCurrency);
            if (!baseCurrencyData) throw new Exception("Base currency not found");

            return currencies
                .filter(c => c.currency !== baseCurrency)
                .map(({currency, rate}) => {
                    const currencyRate = rate / baseCurrencyData.rate;
                    let exchangedValue: number;
                    try {
                        exchangedValue = exchangePrizeValue(baseValue, currencyRate);
                    } catch {
                        exchangedValue = round(baseValue * currencyRate, 8);
                    }
                    return {currency, rate: currencyRate, exchangedValue};
                });
        },
    },
    Mutation: {
        async addCampaign(_: any, {data}: {data: Campaign}, {account}: IContext) {
            validatePermissions(account, data);
            const tool = getTool(data.type);
            const {name, config, providers, games, wallets, operators, brands, playerIds, nativeIds, start, end, enabled} = data;
            if (await Campaign.findOneBy({name})) throw new Exception("Campaign with given name already exists");

            let initialState;
            if (tool.create) {
                initialState = await tool.create({
                    name,
                    config,
                    providers,
                    games,
                    wallets,
                    operators,
                    brands,
                    playerIds,
                    nativeIds,
                    start,
                    end,
                    enabled,
                });
            }

            const fixedDatesData = {...data, start: data.start ? new Date(data.start) : undefined, end: data.end ? new Date(data.end) : undefined};
            const campaign = await Campaign.createWithState(fixedDatesData, initialState);

            if (tool.accumulator) {
                logger.info(`Creating stream for campaign ${campaign.type} ${campaign.campaignId}`);
                const {state: initialState} = await CampaignState.findOneByOrFail({campaignId: campaign.campaignId});

                const nextAccumulationTime = Date.now();
                await CampaignState.update(
                    {campaignId: campaign.campaignId},
                    {
                        state: {
                            data: initialState,
                            nextAccumulationTime,
                            index: 0,
                        } as any,
                    },
                );

                if (data.enabled) {
                    await startStream(campaign.type, campaign.campaignId, nextAccumulationTime);
                }
            }

            await scheduleCampaignFinish(campaign);

            return campaign.campaignId;
        },
        async editCampaign(_: any, {campaignId, data}: {campaignId: string; data: Campaign}, {account}: IContext) {
            const previousCampaign = await Campaign.findOneBy({campaignId});
            if (!previousCampaign) throw new Exception("Couldn't find campaign", {data: {campaignId}});

            const tool = getTool(previousCampaign.type);
            if (!tool.edit) throw new Exception(`Campaign of type ${previousCampaign.type} doesn't support editing`);

            validatePermissions(account, previousCampaign);

            await getConnection("primary").transaction(async manager => {
                const previousState = (await manager.findOne(CampaignState, {where: {campaignId}, select: ["state"], lock: {mode: "pessimistic_write"}}))?.state;
                const mergedData = {...previousCampaign, ...data};
                const editedState = await tool.edit!(previousCampaign, previousState, mergedData);
                const fixedDatesData = {...mergedData, start: mergedData.start ? new Date(mergedData.start) : null, end: mergedData.end ? new Date(mergedData.end) : null};
                await Campaign.updateWithState(campaignId, fixedDatesData, editedState, manager);
            });

            await scheduleCampaignFinish(await Campaign.findOneByOrFail({campaignId}));

            if (tool.accumulator) {
                if (data.enabled) {
                    await startStream(data.type, campaignId, Date.now());
                } else {
                    await stopStream(data.type, campaignId);
                }
            }

            return true;
        },
        async deleteCampaign(_: any, {campaignId}: {campaignId: string}, {account}: IContext) {
            const campaign = await Campaign.findOneBy({campaignId});
            if (!campaign) throw new Exception("Campaign couldn't be find");
            validatePermissions(account, campaign);
            await Campaign.deleteCascade(campaignId);

            await unscheduleCampaignFinish(campaignId);

            await stopStream(campaign.type, campaignId);

            return true;
        },
        async campaignSystemEvent(_: any, {campaignId, eventName, eventId, params}: any) {
            return await systemEvent(campaignId, eventName, eventId, params);
        },
        async clearOptOut(_: any, {campaignId, playerId}: any) {
            await PlayerState.delete({campaignId, playerId, optIn: false});
            return true;
        },
        async addTheme(_: any, {data}: {data: Theme}) {
            if (await Theme.findOneBy({name: data.name})) throw new Exception("Theme with given name already exists");

            const {themeId} = await Theme.save(Theme.create(data));
            return themeId;
        },
        async editTheme(_: any, {themeId, data}: {themeId: string; data: Theme}) {
            const {name, campaignType} = await Theme.findOneByOrFail({themeId});
            if (name != data.name || campaignType != data.campaignType) {
                throw new Exception("Theme name and campaignType cannot be changed", {data});
            }

            await Theme.update({themeId}, data);
            return true;
        },
        async deleteTheme(_: any, {themeId}: {themeId: string}) {
            await getConnection("primary").transaction(async manager => {
                await manager.update(Campaign, {themeId}, {themeId: null});
                await manager.delete(Theme, {themeId});
            });
            return true;
        },
        async importThemes(_: any, {data}: {data: string}) {
            return await importCsv(
                Theme,
                "name",
                data,
                {
                    name: value => value,
                    campaignType: value => value,
                    translations: value => JSON.parse(value),
                    icons: value => JSON.parse(value),
                },
                async data => await this.addTheme(null, {data}),
                async data => {
                    const themeId = (await Theme.findOneBy({name: data.name}))?.themeId;
                    if (!themeId) {
                        throw new Exception("Theme name not found for editing", {data: {name: data.name}});
                    }
                    return await this.editTheme(null, {themeId, data});
                },
            );
        },
    },
};
