import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {Player} from "../db/model/Player";
import {Transaction} from "../db/model/Transaction";
import {TransactionCube} from "../db/model/TransactionCube";
import {CurrencyAlias} from "../db/model/CurrencyAlias";
import {Rgs} from "../db/model/Rgs";
import {Wallet} from "../db/model/Wallet";
import {Account} from "../db/model/Account";
import {generate, IAccount, IColumn, IFilter, IJoin, ISort} from "@slotify/shared/lib/graphQLApi";
import {AuditLog} from "../db/model/AuditLog";
import {Session} from "../db/model/Session";
import {Game} from "../db/model/Game";
import {RoundVerification} from "../db/model/RoundVerification";
import {CurrencyFeed} from "../db/model/CurrencyFeed";
import {ReportReceiver} from "../db/model/ReportReceiver";
import {getPreviousDayInTimezone} from "@slotify/shared/lib/time";
import {round} from "@slotify/shared/lib/round";
import {ReportExclusion} from "../db/model/ReportExclusion";
import logger from "@slotify/shared/lib/logger";

export async function auditLogs(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0) {
    const columns: IColumn[] = [
        {alias: "date", sql: "audit_log.date", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "email", sql: "audit_log.email", filters: ["LIKE", "EQUAL", "NOT_EQUAL"]},
        {alias: "type", sql: "audit_log.type", filters: ["LIKE", "EQUAL", "NOT_EQUAL"]},
        {alias: "action", sql: "audit_log.action", filters: ["LIKE", "EQUAL", "NOT_EQUAL"]},
        {alias: "variables", sql: "audit_log.variables", filters: ["LIKE"], type: "json"},
        {alias: "result", sql: "audit_log.result", filters: ["LIKE"], type: "json"},
        {alias: "success", sql: "audit_log.success"},
        {alias: "ip", sql: "audit_log.ip"},
        {alias: "query", sql: "audit_log.query", filters: ["LIKE"]},
        {alias: "isIpWhitelisted", sql: "audit_log.isIpWhitelisted"},
    ];
    const defaultSort: ISort = {field: "date", order: "DESC"};
    return generate(AuditLog, "audit_log", [], columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
}

export async function players(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "playerId", sql: "player.id", filters: ["EQUAL", "NOT_EQUAL", "IN"], type: "uuid"},
        {alias: "nativeId", sql: "player.nativeId", filters: ["EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "createdAt", sql: "player.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "currency", sql: "player.currency", filters: ["EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "nickname", sql: "player.nickname", filters: ["LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "gender", sql: "player.gender", filters: ["LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "country", sql: "player.country", filters: ["LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "jurisdiction", sql: "player.jurisdiction", filters: ["LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "wallet", sql: "player.wallet", filters: ["IN", "LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "operator", sql: "player.operator", filters: ["IN", "LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "brand", sql: "player.brand", filters: ["IN", "LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "group", sql: "player.group", filters: ["IN", "LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "blocked", sql: "player.blocked", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
    ];

    account.wallets && filter?.push({field: "wallet", type: "IN", value: account.wallets});
    account.operators && filter?.push({field: "operator", type: "IN", value: account.operators});
    account.brands && filter?.push({field: "brand", type: "IN", value: account.brands});

    const defaultSort: ISort = {field: "createdAt", order: "DESC"};
    return generate(Player, "player", [], columns, sort || defaultSort, filter, Math.min(limit, 10000), offset);
}

export async function sessions(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "sessionId", sql: "session.sessionId", filters: ["EQUAL", "NOT_EQUAL", "IN"], type: "uuid"},
        {alias: "createdAt", sql: "session.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "lastActivity", sql: "session.lastActivity", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "endedAt", sql: "session.endedAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "playerId", sql: "session.playerId", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "provider", sql: "session.provider", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "game", sql: "session.game", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "active", sql: "session.active", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "data", sql: "session.data", filters: ["LIKE"], type: "json"},
        {alias: "ip", sql: "session.ip", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "wallet", sql: "player.wallet", filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "operator", sql: "player.operator", filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "brand", sql: "player.brand", filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
    ];

    const joins: IJoin[] = [{entity: Player, alias: "player", condition: "player.id = session.playerId"}];

    account.wallets && filter?.push({field: "wallet", type: "IN", value: account.wallets});
    account.operators && filter?.push({field: "operator", type: "IN", value: account.operators});
    account.brands && filter?.push({field: "brand", type: "IN", value: account.brands});

    const defaultSort: ISort = {field: "createdAt", order: "DESC"};
    return generate(Session, "session", joins, columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
}

export async function accounts(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "email", sql: "account.email", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "comment", sql: "account.comment", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "permissions", sql: "account.permissions", filters: ["CONTAIN", "LIKE"]},
        {alias: "rgss", sql: "account.rgss", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "providers", sql: "account.providers", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "wallets", sql: "account.wallets", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "operators", sql: "account.operators", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "brands", sql: "account.brands", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "ips", sql: "account.ips", filters: ["CONTAIN", "LIKE"]},
        {alias: "lastActivity", sql: "account.lastActivity", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
    ];

    account.wallets && filter?.push({field: "wallets", type: "CONTAIN", value: account.wallets});
    account.operators && filter?.push({field: "operators", type: "CONTAIN", value: account.operators});
    account.brands && filter?.push({field: "brands", type: "CONTAIN", value: account.brands});
    account.providers && filter?.push({field: "providers", type: "CONTAIN", value: account.providers});
    account.rgss && filter?.push({field: "rgss", type: "CONTAIN", value: account.rgss});

    return generate(Account, "account", [], columns, sort, filter, Math.min(limit, 1000), offset);
}

export async function currencyExchange(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0) {
    const columns: IColumn[] = [
        {alias: "id", sql: "currencyExchange.id", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "currency", sql: "currencyExchange.currency", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "date", sql: "currencyExchange.date", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "rate", sql: "currencyExchange.rate", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "dailyDiff", sql: "1 - currencyExchange.rate / NULLIF(yesterday.rate, 0)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "monthlyDiff", sql: "1 - currencyExchange.rate / NULLIF(lastMonth.rate, 0)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
    ];
    const defaultSort: ISort = {field: "date", order: "DESC"};
    const joins: IJoin[] = [
        {entity: CurrencyExchange, alias: "yesterday", condition: "currencyExchange.currency = yesterday.currency and (currencyExchange.date - INTERVAL '1 DAY') = yesterday.date"},
        {entity: CurrencyExchange, alias: "lastMonth", condition: "currencyExchange.currency = lastMonth.currency and (currencyExchange.date - INTERVAL '1 MONTH') = lastMonth.date"},
    ];
    return generate(CurrencyExchange, "currencyExchange", joins, columns, sort || defaultSort, filter, Math.min(limit, 1000), offset);
}

export async function currencyAliases(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0) {
    const columns: IColumn[] = [
        {alias: "alias", sql: "currencyAlias.alias", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "currency", sql: "currencyAlias.currency", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "multiplier", sql: "currencyAlias.multiplier", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
    ];
    return generate(CurrencyAlias, "currencyAlias", [], columns, sort, filter, Math.min(limit, 1000), offset);
}

export async function currencyFeeds(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0) {
    const columns: IColumn[] = [
        {alias: "feed", sql: "currencyFeed.feed", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "enabled", sql: "currencyFeed.enabled", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "config", sql: "currencyFeed.config", type: "json", filters: ["LIKE"]},
        {alias: "currencies", sql: "currencyFeed.currencies", type: "json", filters: ["LIKE"]},
    ];
    return generate(CurrencyFeed, "currencyFeed", [], columns, sort, filter, Math.min(limit, 1000), offset);
}

export async function rgss(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "id", sql: "rgs.id", filters: ["EQUAL", "NOT_EQUAL", "LIKE", "IN"]},
        {alias: "adapter", sql: "rgs.adapter", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "config", sql: "rgs.config", filters: [], sort: false},
        {alias: "inspectionConfig", sql: "rgs.inspectionConfig", filters: [], sort: false},
        {alias: "ips", sql: "rgs.ips", filters: [], sort: false},
    ];

    account.rgss && filter.push({field: "id", type: "IN", value: account.rgss});

    return generate(Rgs, "rgs", [], columns, sort, filter, Math.min(limit, 1000), offset);
}

export async function wallets(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "id", sql: "wallet.id", filters: ["EQUAL", "NOT_EQUAL", "LIKE", "IN"]},
        {alias: "adapter", sql: "wallet.adapter", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "group", sql: "wallet.group", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "enabled", sql: "wallet.enabled", filters: ["EQUAL", "NOT_EQUAL"]},
        {alias: "keyCacheExpiry", sql: "wallet.keyCacheExpiry"},
        {alias: "email", sql: "wallet.email", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "config", sql: "wallet.config", filters: [], sort: false},
        {alias: "inspectionConfig", sql: "wallet.inspectionConfig", filters: [], sort: false},
        {alias: "oneTimeKeyBlocked", sql: "wallet.oneTimeKeyBlocked", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
        {alias: "ipBlocked", sql: "wallet.ipBlocked", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
        {alias: "geoIpBlocked", sql: "wallet.geoIpBlocked", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
        {alias: "ips", sql: "wallet.ips", filters: [], sort: false},
        {alias: "parallelTransactions", sql: "wallet.parallelTransactions", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
    ];

    account.wallets && filter.push({field: "id", type: "IN", value: account.wallets});

    return generate(Wallet, "wallet", [], columns, sort, filter, Math.min(limit, 1000), offset || 0);
}

export async function games(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "game", sql: "game.game", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "title", sql: "game.title", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "type", sql: "game.type", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "provider", sql: "game.provider", filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "rgs", sql: "game.rgs", filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "rgsGame", sql: "game.rgsGame", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "wallets", sql: "game.wallets", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "operators", sql: "game.operators", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "brands", sql: "game.brands", filters: ["CONTAIN", "LIKE"], type: "json"},
        {alias: "rgsConfig", sql: "game.rgsConfig", filters: [], sort: false},
        {alias: "inspectionConfig", sql: "game.inspectionConfig", filters: [], sort: false},
    ];

    account.wallets && filter.push({field: "wallets", type: "CONTAIN", value: account.wallets});
    account.operators && filter.push({field: "operators", type: "CONTAIN", value: account.operators});
    account.brands && filter.push({field: "brands", type: "CONTAIN", value: account.brands});
    account.rgss && filter.push({field: "rgs", type: "IN", value: account.rgss});
    account.providers && filter.push({field: "provider", type: "IN", value: account.providers});

    return generate(Game, "game", [], columns, sort, filter, Math.min(limit, 1000), offset || 0);
}

export async function reportReceivers(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "id", sql: "report.id", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "cron", sql: "report.cron", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "report", sql: "report.report", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "account", sql: "report.account", filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "email", sql: "report.email", filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "variables", sql: "report.variables", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "comment", sql: "report.comment"},
    ];

    account.email && filter.push({field: "account", type: "EQUAL", value: account.email});

    return generate(ReportReceiver, "report", [], columns, sort, filter, Math.min(limit, 1000), offset || 0);
}

export async function reportExclusion(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount) {
    const columns: IColumn[] = [
        {alias: "id", sql: "reportExclusion.id", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "createdAt", sql: "reportExclusion.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "updatedAt", sql: "reportExclusion.updatedAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "startsAt", sql: "reportExclusion.startsAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "endsAt", sql: "reportExclusion.endsAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "playerId", sql: "reportExclusion.playerId", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "nativeId", sql: "reportExclusion.nativeId", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "wallet", sql: "reportExclusion.wallet", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "operator", sql: "reportExclusion.operator", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "brand", sql: "reportExclusion.brand", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "currency", sql: "reportExclusion.currency", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "inspection", sql: "reportExclusion.inspection", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
        {alias: "gameWin", sql: "reportExclusion.gameWin", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
        {alias: "comment", sql: "reportExclusion.comment"},
        {alias: "reason", sql: "reportExclusion.reason"},
    ];

    account.wallets && filter.push({field: "wallet", type: "CONTAIN", value: account.wallets});

    return generate(ReportExclusion, "reportExclusion", [], columns, sort, filter, Math.min(limit, 1000), offset || 0);
}

export async function transactions(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount, options: any) {
    const convert = options?.convert;
    const rate = !convert ? "1" : "currencyExchange.rate";
    const baseCurrency = process.env.BASE_CURRENCY!;

    const columns: IColumn[] = [
        {alias: "transactionId", sql: "transaction.id", filters: ["EQUAL", "NOT_EQUAL"], type: "uuid"},
        {alias: "createdAt", sql: "transaction.createdAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "finishedAt", sql: "transaction.finishedAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "cancelledAt", sql: "transaction.cancelledAt", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "type", sql: "transaction.type", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "amount", sql: `transaction.amount / NULLIF(${rate}, 0)`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL", "EQUAL", "NOT_EQUAL"]},
        {alias: "jackpotAmount", sql: `transaction.jackpotAmount / NULLIF(${rate}, 0)`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "roundId", sql: "transaction.roundId", filters: ["EQUAL", "NOT_EQUAL"]},
        {alias: "rgsTransactionId", sql: "transaction.rgsTransactionId", filters: ["EQUAL", "NOT_EQUAL"]},
        {alias: "rgsRoundId", sql: "transaction.rgsRoundId", filters: ["EQUAL", "NOT_EQUAL"]},
        {alias: "status", sql: "transaction.status", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "failReason", sql: "transaction.failReason", filters: ["EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "game", sql: "transaction.game", filters: ["EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "variant", sql: "transaction.variant", filters: ["EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "roundFinished", sql: "transaction.roundFinished", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "rgs", sql: "transaction.rgs", filters: ["IN", "EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "provider", sql: "transaction.provider", filters: ["IN", "EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "playerId", sql: "transaction.playerId", filters: ["EQUAL", "NOT_EQUAL"], type: "uuid"},
        {alias: "sessionId", sql: "transaction.sessionId", filters: ["EQUAL", "NOT_EQUAL"], type: "uuid"},
        {alias: "category", sql: "transaction.category", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "name", sql: "transaction.name", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "channel", sql: "transaction.channel", filters: ["EQUAL", "NOT_EQUAL", "IN", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "campaignType", sql: "transaction.campaignType", filters: ["EQUAL", "NOT_EQUAL", "IN"]},
        {alias: "campaignId", sql: "transaction.campaignId", filters: ["EQUAL", "NOT_EQUAL"], type: "uuid"},
        {alias: "ip", sql: "transaction.ip", filters: ["EQUAL", "NOT_EQUAL"]},
        {alias: "winRatio", sql: `transaction.winRatio`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL", "EQUAL", "NOT_EQUAL"]},
        {alias: "balanceAfter", sql: `transaction.balanceAfter / NULLIF(${rate}, 0)`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL", "EQUAL", "NOT_EQUAL"]},
        {alias: "auto", sql: "transaction.auto", filters: ["EQUAL", "NOT_EQUAL"]},
        {alias: "currency", sql: !convert ? "player.currency" : `'${baseCurrency}'`, filters: convert ? [] : ["EQUAL", "LIKE"], sort: !convert},
        {alias: "operator", sql: "player.operator", join: "player", filters: ["IN", "EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "brand", sql: "player.brand", join: "player", filters: ["IN", "EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "wallet", sql: "player.wallet", join: "player", filters: ["IN", "EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "jurisdiction", sql: "player.jurisdiction", join: "player", filters: ["IN", "EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "nativeId", sql: "player.nativeId", join: "player", filters: ["EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {
            alias: "replayUrl",
            join: "player",
            filters: [],
            sort: false,
            sql: `CONCAT('${process.env.URL || ""}/launch/replay?rgs=', transaction.rgs,'&provider=', transaction.provider, '&roundId=', transaction.roundId, '&game=', transaction.game, '&wallet=', player.wallet, '&operator=', player.operator)`,
        },
        {alias: "verificationScore", sql: "verification.score"},
        {alias: "verificationAction", sql: "verification.action", filters: ["IN", "EQUAL", "NOT_EQUAL"]},
        {alias: "verificationDetails", sql: "verification.details"},
        {alias: "regulatory", sql: "transaction.regulatory"},
    ];
    const joins: IJoin[] = [
        {entity: Player, alias: "player", condition: "player.id = transaction.playerId"},
        {entity: RoundVerification, alias: "verification", condition: "verification.roundId = transaction.roundId"},
        {
            entity: CurrencyExchange,
            alias: "currencyExchange",
            condition:
                "currencyExchange.id = (select id from adapter_currency_exchange \"currencyExchange\" where currencyExchange.currency = player.currency and date_trunc('day', currencyExchange.date) <= date_trunc('day', COALESCE(transaction.finishedAt, transaction.createdAt)) - INTERVAL '1 DAY' order by currencyExchange.date DESC limit 1)",
        },
    ];

    account.wallets && filter.push({field: "wallet", type: "IN", value: account.wallets});
    account.operators && filter.push({field: "operator", type: "IN", value: account.operators});
    account.brands && filter.push({field: "brand", type: "IN", value: account.brands});
    account.rgss && filter.push({field: "rgs", type: "IN", value: account.rgss});
    account.providers && filter.push({field: "provider", type: "IN", value: account.providers});

    return generate(Transaction, "transaction", joins, columns, sort, filter, Math.min(limit, 1000000), offset);
}

export async function aggregateTransactions(filter: IFilter[]) {
    const columns: IColumn[] = [
        {alias: "finishedAt", sql: "transaction.finishedAt", skipSelect: true, join: "transaction", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL", "NOT_NULL"]},
        {alias: "cancelledAt", sql: "transaction.cancelledAt", skipSelect: true, join: "transaction", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "status", sql: "transaction.status", skipSelect: true, filters: ["EQUAL", "IN"]},
        {alias: "category", sql: "transaction.category", group: true},
        {alias: "name", sql: "transaction.name", group: true},
        {alias: "campaignType", sql: "transaction.campaignType", group: true},
        {alias: "campaignId", sql: "transaction.campaignId", group: true},
        {alias: "game", sql: "transaction.game", group: true},
        {alias: "channel", sql: "transaction.channel", group: true},
        {alias: "variant", sql: "transaction.variant", group: true},
        {alias: "rgs", sql: "transaction.rgs", group: true},
        {alias: "provider", sql: "transaction.provider", group: true},
        {alias: "currency", sql: "player.currency", join: "player", group: true},
        {alias: "playerId", sql: "player.id", join: "player", group: true},
        {alias: "operator", sql: "player.operator", join: "player", group: true},
        {alias: "brand", sql: "player.brand", join: "player", group: true},
        {alias: "wallet", sql: "player.wallet", join: "player", group: true},
        {alias: "bets", sql: "COALESCE(SUM(CASE WHEN transaction.type='withdraw' THEN 1 ELSE 0 END), 0)"},
        {alias: "wins", sql: "COALESCE(SUM(CASE WHEN transaction.type='deposit' THEN 1 ELSE 0 END), 0)"},
        {alias: "totalBet", sql: "COALESCE(SUM(CASE WHEN transaction.type='withdraw' THEN transaction.amount ELSE 0 END), 0)"},
        {alias: "totalWin", sql: "COALESCE(SUM(CASE WHEN transaction.type='deposit' THEN transaction.amount ELSE 0 END), 0)"},
        {alias: "normalisedTotalBet", sql: "COALESCE(SUM(CASE WHEN transaction.type='withdraw' THEN transaction.normalisedAmount ELSE 0 END), 0)"},
        {alias: "normalisedTotalWin", sql: "COALESCE(SUM(CASE WHEN transaction.type='deposit' THEN transaction.normalisedAmount ELSE 0 END), 0)"},
        {alias: "jackpotContribution", sql: "COALESCE(SUM(CASE WHEN transaction.type='withdraw' THEN transaction.jackpotAmount ELSE 0 END), 0)"},
        {alias: "jackpotWin", sql: "COALESCE(SUM(CASE WHEN transaction.type='deposit' THEN transaction.jackpotAmount ELSE 0 END), 0)"},
    ];

    const joins: IJoin[] = [{entity: Player, alias: "player", condition: "player.id = transaction.playerId"}];
    return generate(Transaction, "transaction", joins, columns, undefined, filter, undefined, 0);
}

export async function gameWin(sort: ISort | undefined, filter: IFilter[] = [], limit: number = 10, offset: number = 0, account: IAccount, options: null | {convert?: boolean; dimensions: string[]; interval: string}) {
    const convert = options?.convert;
    const rate = !convert ? "1" : "currencyExchange.rate";
    const baseCurrency = process.env.BASE_CURRENCY!;
    const columns: any[] = [
        {alias: "date", sql: "transaction.date", skipSelect: true, join: "transaction", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},

        {alias: "hour", sql: "to_char(transaction.date, 'YYYY-MM-DD HH24:00')", group: true, join: "transaction", filters: ["LIKE", "EQUAL"]},
        {alias: "day", sql: "to_char(transaction.date, 'YYYY-MM-DD')", group: true, join: "transaction", filters: ["LIKE", "EQUAL"]},
        {alias: "month", sql: "to_char(transaction.date, 'YYYY-MM')", group: true, join: "transaction", filters: ["LIKE", "EQUAL"]},
        {alias: "year", sql: "to_char(transaction.date, 'YYYY')", group: true, join: "transaction", filters: ["LIKE", "EQUAL"]},

        {alias: "players", sql: "COUNT(DISTINCT transaction.playerId)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "playerId", sql: "transaction.playerId", group: true, filters: ["EQUAL", "NOT_EQUAL"], type: "uuid"},
        {alias: "nativeId", sql: "player.nativeId", group: true, join: "player", filters: ["EQUAL", "NOT_EQUAL", "IN", "LIKE"]},
        {alias: "category", sql: "transaction.category", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "name", sql: "transaction.name", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "campaignType", sql: "transaction.campaignType", group: true, filters: ["LIKE", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "campaignId", sql: "transaction.campaignId", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL"]},
        {alias: "game", sql: "transaction.game", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "gameTitle", sql: "game.title", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "provider", sql: "transaction.provider", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "rgs", sql: "transaction.rgs", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "currencyExchangeRate", sql: !convert ? "avg(currencyExchange.rate)" : "1", group: false, sort: !convert},
        {alias: "currency", sql: !convert ? "transaction.currency" : `'${baseCurrency}'`, group: !convert, filters: convert ? [] : ["EQUAL", "LIKE"], sort: !convert},
        {alias: "operator", sql: "transaction.operator", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "brand", sql: "transaction.brand", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "wallet", sql: "transaction.wallet", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "walletGroup", sql: "wallet.group", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "playerGroup", sql: "player.group", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "variant", sql: "transaction.variant", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "channel", sql: "transaction.channel", group: true, filters: ["EQUAL", "NOT_EQUAL", "IN", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "country", sql: "player.country", filters: ["EQUAL", "NOT_EQUAL", "LIKE"], group: true},
        {alias: "jurisdiction", sql: "player.jurisdiction", filters: ["EQUAL", "NOT_EQUAL", "LIKE"], group: true},
        {alias: "bets", sql: "COALESCE(SUM(transaction.bets), 0)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "jackpotContribution", sql: "COALESCE(SUM(transaction.jackpotContribution), 0)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "jackpotWin", sql: "COALESCE(SUM(transaction.jackpotWin), 0)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "wins", sql: "COALESCE(SUM(transaction.wins), 0)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "totalBet", sql: `COALESCE(SUM(transaction.totalBet / NULLIF(${rate}, 0)), 0)`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "totalWin", sql: `COALESCE(SUM(transaction.totalWin / NULLIF(${rate}, 0)), 0)`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {
            alias: "gameWin",
            sql: `COALESCE(SUM((transaction.totalBet - transaction.jackpotContribution) /  NULLIF(${rate}, 0)), 0) - COALESCE(SUM((transaction.totalWin - transaction.jackpotWin) / NULLIF(${rate}, 0)), 0)`,
            filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"],
        },
        {alias: "rtp", sql: `COALESCE(SUM(transaction.totalWin / NULLIF(${rate}, 0)) / NULLIF(SUM(transaction.totalBet /  NULLIF(${rate}, 0)), 0), 0)`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {
            alias: "normalisedRtp",
            sql: `COALESCE(SUM(transaction.normalisedTotalWin / NULLIF(${rate}, 0)) / NULLIF(SUM(transaction.normalisedTotalBet /  NULLIF(${rate}, 0)), 0), 0)`,
            filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"],
        },
        {alias: "exclusionReason", sql: "exclusion.reason", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "excluded", sql: "exclusion.excluded", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL"]},
        {alias: "empty", sql: "transaction.empty", skipSelect: true},
    ].map(column => {
        const include = column.alias === options?.interval || options?.dimensions?.includes(column.alias) || column.alias === "currency";
        return {...column, group: column.group && include, skipSelect: column.skipSelect || (column.group && !include)};
    });

    const joins: IJoin[] = [
        {
            entity: CurrencyExchange,
            alias: "currencyExchange",
            condition:
                "currencyExchange.id = (select id from adapter_currency_exchange \"currencyExchange\" where currencyExchange.currency = transaction.currency and currencyExchange.date <= date_trunc('day', transaction.date) - INTERVAL '1 DAY' order by currencyExchange.date DESC limit 1)",
        },
        {entity: Player, alias: "player", condition: "player.id = transaction.playerId"},
        {entity: Wallet, alias: "wallet", condition: "wallet.id = player.wallet"},
        {entity: Game, alias: "game", condition: "transaction.game = game.game"},
        {entity: "(SELECT 1)", alias: "", condition: `TRUE LEFT JOIN LATERAL (${ReportExclusion.TRANSACTION_EXCLUSION_CHECK_SQL}) exclusion ON TRUE`},
    ];
    filter.push({field: "empty", type: "NULL"});

    account.wallets && filter.push({field: "wallet", type: "IN", value: account.wallets});
    account.operators && filter.push({field: "operator", type: "IN", value: account.operators});
    account.brands && filter.push({field: "brand", type: "IN", value: account.brands});
    account.rgss && filter.push({field: "rgs", type: "IN", value: account.rgss});
    account.providers && filter.push({field: "provider", type: "IN", value: account.providers});

    return generate(TransactionCube, "transaction", joins, columns, sort, filter, Math.min(limit, 100000), offset);
}

export async function DGE_gameSummary(sort: ISort | undefined, filter: IFilter[] = [], limit: number | undefined = undefined, offset: number = 0, account: IAccount, options: null | {wallet?: string; timestamp?: number}) {
    const columns: IColumn[] = [
        {alias: "createdAt", sql: "transaction.createdAt", skipSelect: true, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "finishedAt", sql: "transaction.finishedAt", skipSelect: true, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "cancelledAt", sql: "transaction.cancelledAt", skipSelect: true, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "status", sql: "transaction.status", skipSelect: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "game", sql: "transaction.game", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "type", sql: "transaction.type", group: true, filters: ["EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "wallet", sql: "player.wallet", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "LIKE"]},
        {alias: "operator", sql: "player.operator", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
        {alias: "brand", sql: "player.brand", group: true, filters: ["IN", "EQUAL", "NOT_EQUAL", "NULL", "NOT_NULL", "LIKE"]},
    ];
    const columnsBetWin: IColumn[] = [
        {alias: "bets", sql: "count(case when type = 'withdraw' then 1 end)"},
        {alias: "wins", sql: "count(case when type = 'deposit' then 1 end)"},
        {alias: "totalBet", sql: `sum(case when type = 'withdraw' then amount else 0 end)`},
        {alias: "totalWin", sql: `sum(case when type = 'deposit' then amount else 0 end)`},
    ];
    const columnsCancel: IColumn[] = [
        {alias: "wins", sql: "count(case when type = 'withdraw' then 1 end)", filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
        {alias: "totalWin", sql: `sum(case when type = 'withdraw' then amount else 0 end)`, filters: ["GREATER", "GREATER_OR_EQUAL", "LOWER", "LOWER_OR_EQUAL"]},
    ];

    const {start, end} = getPreviousDayInTimezone(options?.timestamp || Date.now(), "America/New_York");
    const filterBet: IFilter[] = [
        {field: "createdAt", type: "GREATER_OR_EQUAL", value: start},
        {field: "createdAt", type: "LOWER_OR_EQUAL", value: end},
        {field: "type", type: "EQUAL", value: "withdraw"},
        {field: "status", type: "IN", value: ["finished", "cancel", "cancelled"]},
    ];
    const filterWin: IFilter[] = [
        {field: "createdAt", type: "GREATER_OR_EQUAL", value: start},
        {field: "createdAt", type: "LOWER_OR_EQUAL", value: end},
        {field: "type", type: "EQUAL", value: "deposit"},
        {field: "status", type: "IN", value: ["started", "finished", "failed", "rejected"]},
    ];
    const filterCancel: IFilter[] = [
        {field: "cancelledAt", type: "GREATER_OR_EQUAL", value: start},
        {field: "cancelledAt", type: "LOWER_OR_EQUAL", value: end},
        {field: "status", type: "EQUAL", value: "cancelled"},
    ];

    account.wallets && filter.push({field: "wallet", type: "IN", value: account.wallets});
    account.operators && filter.push({field: "operator", type: "IN", value: account.operators});
    account.brands && filter.push({field: "brand", type: "IN", value: account.brands});

    options?.wallet && filter.push({field: "wallet", type: "EQUAL", value: options.wallet});

    const joins: IJoin[] = [{entity: Player, alias: "player", condition: "player.id = transaction.playerId"}];
    const betResults = await generate(Transaction, "transaction", joins, [...columns, ...columnsBetWin], sort, [...filter, ...filterBet], limit, offset);
    const winResults = await generate(Transaction, "transaction", joins, [...columns, ...columnsBetWin], sort, [...filter, ...filterWin], limit, offset);
    const cancelResults = await generate(Transaction, "transaction", joins, [...columns, ...columnsCancel], sort, [...filter, ...filterCancel], limit, offset);

    logger.info("DGE_gameSummary", {betResults, winResults, cancelResults, options, filter, offset, limit, sort});
    const items = [...betResults.items];

    for (const cancel of [...winResults.items, ...cancelResults.items]) {
        let item = items.find(item => {
            for (const alias of ["wallet", "operator", "brand", "game"]) {
                if (item[alias] !== cancel[alias]) return false;
            }
            return true;
        });
        if (item) {
            item.wins = round(parseInt(item.wins, 10) + parseInt(cancel.wins, 10), 0);
            item.totalWin = round(parseFloat(item.totalWin) + parseFloat(cancel.totalWin), 2);
        } else {
            item = {...cancel, bets: 0, totalBet: 0};
            items.push(item);
        }
    }

    for (const item of items) {
        item.gameWin = round(parseFloat(item.totalBet) - parseFloat(item.totalWin), 2);
        item.from = start;
        item.to = end;
    }
    return {items};
}
