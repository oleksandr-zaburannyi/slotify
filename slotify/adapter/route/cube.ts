import {Transaction} from "../db/model/Transaction";
import {aggregateTransactions} from "./report";
import {DateTime} from "../util/luxon";
import {TransactionCube} from "../db/model/TransactionCube";
import logger from "@slotify/shared/lib/logger";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import wait from "@slotify/shared/lib/wait";
import {redis} from "@slotify/shared/lib/redis";
import {v4} from "uuid";
import Exception from "@slotify/shared/lib/Exception";

const lockId = v4();

export default async function cube(regenerateDate?: Date, delay: number = 1000, onComplete: () => any = () => null) {
    if (!(await redis.set("cubeLock", lockId, {EX: 5 * 60, NX: true}))) {
        throw new Exception("There is another aggregation in progress. Please try again later");
    }

    startAggregation(regenerateDate, delay).then(onComplete);
}

function isSameDbInstance(connectionA: string, connectionB: string): boolean {
    const a = getConnection(connectionA).options as {host?: string; port?: number; database?: string};
    const b = getConnection(connectionB).options as {host?: string; port?: number; database?: string};
    return a.host === b.host && a.port === b.port && a.database === b.database;
}

async function startAggregation(regenerateDate?: Date, delay: number = 1000) {
    logger.info("aggregateReports started");

    const [{replication}] = await getConnection("replica").query("select pg_last_xact_replay_timestamp() as replication;");
    const replicationTime = replication ? DateTime.fromJSDate(replication) : DateTime.local();

    const startingTransactionDate = regenerateDate || (await TransactionCube.getLast())?.date || (await Transaction.getFirst())?.finishedAt;

    if (!startingTransactionDate) {
        logger.warn("There are no transactions to aggregate");
        return;
    }

    const format = "yyyy-MM-dd HH:mm";

    const interval = "hour";
    let from = DateTime.fromJSDate(startingTransactionDate, {zone: "utc"}).startOf(interval);
    const end = DateTime.utc().startOf(interval);

    while (from.diff(end, interval).as(interval) <= 0) {
        const to = from.plus({[interval]: 1});
        const isCurrentHour = from.diff(end, interval).as(interval) === 0;
        if (!isSameDbInstance("primary", "replica") && replicationTime.diff(to).as("milliseconds") < 0 && !isCurrentHour) {
            logger.error(`Couldn't run aggregation as replication lag is ${replicationTime.diff(to).as("milliseconds")}ms`, {replicationTime, from, to});
            break;
        }

        const data: any[] = ([] as any[])
            .concat(
                (
                    await aggregateTransactions([
                        {field: "finishedAt", type: "GREATER_OR_EQUAL", value: from.toFormat(format)},
                        {field: "finishedAt", type: "LOWER", value: to.toFormat(format)},
                        {field: "status", type: "IN", value: ["finished", "cancelled"]},
                    ])
                ).items,
            )
            .concat(
                (
                    await aggregateTransactions([
                        {field: "finishedAt", type: "NOT_NULL"},
                        {field: "cancelledAt", type: "GREATER_OR_EQUAL", value: from.toFormat(format)},
                        {field: "cancelledAt", type: "LOWER", value: to.toFormat(format)},
                        {field: "status", type: "EQUAL", value: "cancelled"},
                    ])
                ).items.map(item => ({...item, bets: -item.bets, totalBet: -item.totalBet, normalisedTotalBet: -item.normalisedTotalBet, jackpotContribution: -item.jackpotContribution})),
            );

        logger.info(`Generating cube for: ${from.toFormat(format)} - ${to.toFormat(format)}. ${data.length} rows`);

        await getConnection("primary").transaction(async manager => {
            await manager.delete(TransactionCube, {date: from.toJSDate()});
            if (data.length > 0) {
                const chunkSize = 100;
                data.forEach(item => (item.date = from.toJSDate()));
                for (let i = 0; i < data.length; i += chunkSize) {
                    await manager.insert(TransactionCube, data.slice(i, i + chunkSize));
                }
            } else {
                await manager.insert(TransactionCube, {date: from.toJSDate(), empty: true});
            }
        });

        from = from.plus({[interval]: 1});

        await redis.set("cubeLock", lockId, {EX: 5 * 60});
        await wait(delay); //given it can be CPU intensive when regenerates longer period, we need some cool-off time
    }
    await redis.del("cubeLock");
}
