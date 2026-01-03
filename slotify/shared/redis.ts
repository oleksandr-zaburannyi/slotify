import {createClient} from "redis";
import logger from "./logger";
import wait from "./wait";

export const database = parseInt(process.env.REDIS_DATABASE || "0");
export const host = process.env.REDIS_HOST || "localhost";
export const port = parseInt(process.env.REDIS_PORT || "6379");
export const tls = process.env.REDIS_TLS === "true";

export const redis = createInstance("main");
export const redisPubSub = createInstance("pubsub");

export async function initRedis(name: string) {
    logger.info(`Initializing Redis ${name}`);

    await redis.connect();
    await redisPubSub.connect();
}

export async function closeRedis() {
    try {
        if (redis.isReady) {
            await redis.disconnect();
        }
        if (redisPubSub.isReady) {
            await redisPubSub.disconnect();
        }
        await wait(100);
    } catch (e) {
        logger.warn("Redis disconnection error", {e});
    }
}

function createInstance(type: "main" | "pubsub") {
    const instance = createClient({database, socket: {host, port, tls}});
    instance
        .on("error", (error: any) => logger.warn(`[${type}] Redis Client Error`, {error, database, host, port}))
        .on("connect", () => logger.info(`[${type}] Connected to Redis DB`))
        .on("ready", () => logger.info(`[${type}] Client ready to use Redis DB`))
        .on("end", () => logger.warn(`[${type}] Client disconnected from Redis DB`));
    return instance;
}
