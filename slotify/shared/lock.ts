import {redis} from "./redis";
import {v4} from "uuid";

export async function lock(lockId: string, expiryMs: number) {
    return await redis.set(lockId, v4(), {PX: expiryMs, NX: true});
}

export async function hasLock(lockId: string) {
    return !!(await redis.get(lockId));
}

export async function unlock(lockId: string) {
    return await redis.del(lockId);
}
