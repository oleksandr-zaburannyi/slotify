import logger from "./logger";
import {redis, redisPubSub} from "./redis";

function addInvalidationListener(dependencies: string[], callback: () => any) {
    const addListener = () => {
        redisPubSub.unsubscribe("connect", addListener).catch(e => {
            logger.warn("Error unsubscribing from connect (redis)", {error: e});
        });
        dependencies.forEach(id => {
            redisPubSub.subscribe(`invalidate/${id}`, callback).catch(e => {
                logger.warn("Error subscribing to invalidate (redis)", {id, error: e});
            });
        });
    };

    if (redisPubSub.isReady) {
        addListener();
    } else {
        redisPubSub.on("connect", addListener);
    }
}

type IValue<T = any> = {val: T; startTime: number};
export default function cache<T, K extends Array<any>>(seconds: number, func: (...args: K) => T, dependencies?: string[]): (...args: K) => T {
    const val: Record<string, IValue<T>> = {};
    const listenersAdded: Record<string, boolean> = {};
    return (...args: K): T => {
        const now = Date.now();
        const key = JSON.stringify(args);

        if (val[key] === undefined || now - val[key].startTime > seconds * 1000) {
            val[key] = {val: func(...args), startTime: now};
        }
        if (dependencies && !listenersAdded[key]) {
            listenersAdded[key] = true;
            addInvalidationListener(dependencies, () => delete val[key]);
        }
        return val[key].val;
    };
}

export function invalidate(id: string) {
    redis.publish(`invalidate/${id}`, "").catch(e => {
        logger.warn("Error publishing invalidate message (redis)", {id, error: e});
    });
}
