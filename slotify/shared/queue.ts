import {redis} from "./redis";
import {v4} from "uuid";
import wait from "./wait";
import Exception from "./Exception";
import {lock, unlock} from "./lock";

export async function executeInQueue<T>(queue: string | false, func: () => T, waitDelay = 5, timeout = 15 * 1000) {
    if (queue === false) return func();

    const id = v4();
    const lockId = `lock-queue:${queue}`;
    const startTime = Date.now();
    await redis.zRemRangeByScore(queue, 0, startTime - timeout); //removes expired

    await redis.zAdd(queue, {score: Date.now(), value: id});
    do {
        const [currentId] = await redis.zRangeByScore(queue, 0, Date.now(), {LIMIT: {offset: 0, count: 1}});
        if (currentId === id && (await lock(lockId, timeout))) break;

        if (startTime + timeout < Date.now()) throw new Exception(`Queue ${queue} timeout`);
        await wait(waitDelay);
    } while (true);

    try {
        return await func();
    } finally {
        await redis.zRem(queue, id);
        await unlock(lockId);
    }
}
