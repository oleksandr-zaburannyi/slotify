import Exception from "@slotify/shared/lib/Exception";
import {IRgsAdapter} from "./IRgsAdapter";
import standardRgsAdapter from "./standardRgsAdapter";
import {Express, Response, Router} from "express";
import {Rgs} from "../db/model/Rgs";
import {checkIPWhitelisting, getIp} from "@slotify/shared/lib/ip";
import logger from "@slotify/shared/lib/logger";
import {redisPubSub} from "@slotify/shared/lib/redis";

const rgsAdapterTypes: {[key: string]: IRgsAdapter} = {
    "standard": standardRgsAdapter,
};

interface RgsEntry {
    adapter: IRgsAdapter;
    router: Router;
}

let rgsEntries: Map<string, RgsEntry> = new Map();
let reloading = false;
let reloadPending = false;
let pendingRetries = 0;
const MAX_PENDING_RETRIES = 3;

function createRgsEntry(rgsId: string, rgs: Rgs): RgsEntry | null {
    const adapterType = rgsAdapterTypes[rgs.adapter];
    if (!adapterType) {
        logger.warn(`Cannot load RGS ${rgsId}: adapter '${rgs.adapter}' not found`);
        return null;
    }

    const router = Router();

    // IP whitelist middleware for this RGS
    if (rgs.ips) {
        const whitelistedIps = rgs.ips; // Capture for closure to avoid non-null assertion
        router.use((req, res, next) => {
            const ip = getIp(req);
            if (!checkIPWhitelisting(ip, whitelistedIps)) {
                throw new Exception("RGS IP not whitelisted", {data: {ip, ips: whitelistedIps, id: rgsId, adapter: rgs.adapter}});
            }
            next();
        });
    }

    adapterType.init(rgsId, router, rgs.config);

    return {adapter: adapterType, router};
}

async function loadRgs(rgsId: string): Promise<void> {
    const rgs = await Rgs.getById(rgsId);
    if (!rgs) {
        logger.warn(`Cannot load RGS ${rgsId}: not found`);
        return;
    }

    const entry = createRgsEntry(rgsId, rgs);
    if (entry) {
        rgsEntries.set(rgsId, entry);
        logger.info(`Loaded RGS: ${rgsId} (adapter: ${rgs.adapter})`);
    }
}

async function reloadAll(isPendingRetry = false): Promise<void> {
    if (reloading) {
        reloadPending = true;
        logger.debug("RGS reload already in progress, will reload again after completion");
        return;
    }
    reloading = true;
    if (!isPendingRetry) {
        pendingRetries = 0;
    }

    try {
        const currentRgss = await Rgs.find();
        const newEntries = new Map<string, RgsEntry>();
        const previousCount = rgsEntries.size;

        // Build new map completely before swapping
        for (const rgs of currentRgss) {
            try {
                const entry = createRgsEntry(rgs.id, rgs);
                if (entry) {
                    newEntries.set(rgs.id, entry);
                }
            } catch (e) {
                logger.error(`Failed to load RGS ${rgs.id} (adapter: ${rgs.adapter})`, {error: e});
            }
        }

        // Atomic swap - assign new map reference
        rgsEntries = newEntries;

        logger.info(`Reloaded RGS adapters: ${newEntries.size} loaded, ${previousCount} previous`);
    } finally {
        reloading = false;
        if (reloadPending) {
            reloadPending = false;
            if (pendingRetries < MAX_PENDING_RETRIES) {
                pendingRetries++;
                reloadAll(true).catch(e => logger.error("Error in pending RGS reload", {error: e}));
            } else {
                logger.warn("Max pending RGS reload retries reached, skipping");
            }
        }
    }
}

export function getRgsAdapter(id: string): IRgsAdapter {
    const rgsAdapter = rgsAdapterTypes[id];
    if (!rgsAdapter) throw new Exception(`Couldn't find RGS adapter '${id}'`);
    return rgsAdapter;
}

async function handleUnknownRgs(rgsId: string, res: Response): Promise<void> {
    try {
        try {
            await Rgs.getById(rgsId);
            res.status(404).json({error: {code: "RGS_NOT_CONFIGURED", message: `RGS '${rgsId}' not configured`}});
        } catch {
            res.status(404).json({error: {code: "RGS_NOT_FOUND", message: `RGS '${rgsId}' not found`}});
        }
    } catch (e) {
        logger.error(`Failed to check RGS status`, {error: e, rgsId});
        if (!res.headersSent) {
            res.status(500).json({error: {code: "INTERNAL_ERROR", message: "Internal server error"}});
        }
    }
}

export async function initRgsApi(api: Express): Promise<void> {
    const mainRouter = Router();

    // Dynamic dispatch middleware - check memory first to reduce latency
    mainRouter.use("/:rgsId", (req, res, next) => {
        const {rgsId} = req.params;

        // First check memory map for fast path
        const entry = rgsEntries.get(rgsId);
        if (entry) {
            return entry.router(req, res, next);
        }

        // Not in map - check if it exists in DB but not loaded yet
        handleUnknownRgs(rgsId, res);
    });

    api.use("/rgs", mainRouter);

    // Initial load of all RGS
    const rgss = await Rgs.getRgss();
    for (const rgs of rgss) {
        try {
            await loadRgs(rgs.id);
        } catch (e) {
            logger.error(`Failed to load RGS ${rgs.id} during startup`, {error: e});
        }
    }

    // Subscribe to invalidation events for hot-reload
    try {
        await redisPubSub.subscribe("invalidate/rgss", () => {
            logger.info("RGS invalidation received, reloading RGS adapters");
            reloadAll().catch(e => logger.error("Error reloading RGS adapters", {error: e}));
        });
        logger.info("Subscribed to RGS invalidation events");
    } catch (e) {
        logger.error("Failed to subscribe to RGS invalidation events, service cannot start", {error: e});
        throw e;
    }
}
