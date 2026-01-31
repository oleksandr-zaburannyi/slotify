import Exception from "@slotify/shared/lib/Exception";
import {Wallet} from "../db/model/Wallet";
import IWalletAdapter from "./IWalletAdapter";
import StandardWalletAdapter from "./StandardWalletAdapter";
import {Express, Response, Router} from "express";
import SoftSwissWalletAdapter from "./SoftSwissWalletAdapter";
import logger from "@slotify/shared/lib/logger";
import OpenBoxWalletAdapter from "./OpenBoxWalletAdapter";
import ISoftBetWalletAdapter from "./ISoftBetWalletAdapter";
import PlaytechWalletAdapter from "./PlaytechWalletAdapter";
import RelaxWalletAdapter from "./RelaxWalletAdapter";
import LnwWalletAdapter from "./LnwWalletAdapter";
import QTechWalletAdapter from "./QTechWalletAdapter";
import BetConstructWalletAdapter from "./BetConstructWalletAdapter";
import ReevoWalletAdapter from "./ReevoWalletAdapter";
import SlotegratorWalletAdapter from "./SlotegratorWalletAdapter";
import FizzyBubblyWalletAdapter from "./FizzyBubblyWalletAdapter";
import SoftSwiss2WalletAdapter from "./SoftSwiss2WalletAdapter";
import SlotifyWalletAdapter from "./SlotifyWalletAdapter";
import BadHombreWalletAdapter from "./BadHombreWalletAdapter";
import GrrrWalletAdapter from "./GrrrWalletAdapter";
import {PinUpWalletAdapter} from "./PinUpWalletAdapter";
import AleaWalletAdapter from "./AleaWalletAdapter";
import {redisPubSub} from "@slotify/shared/lib/redis";

export const errorCodes = {
    PLAYER_UNAUTHORIZED: "PLAYER_UNAUTHORIZED",
    SERVER_UNAUTHORIZED: "SERVER_UNAUTHORIZED",
    INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
    LOSS_LIMIT: "LOSS_LIMIT", //a.k.a. bet limits
    TIME_LIMIT: "TIME_LIMIT",
    TRANSACTION_FAILED: "TRANSACTION_FAILED", //wallet acknowledges transaction didn't happen - we will not cancel it
    TRANSACTION_NOT_FOUND: "TRANSACTION_NOT_FOUND", //this code returned by cancel means transaction never happened, so we can assume cancel is succesful
    UNKNOWN: "UNKNOWN", //generic error - withdrawals will be canceled
    CLOSE_ROUND: "CLOSE_ROUND", //causes round to be forced to close (without auto-completing)
    CANCEL_TRANSACTION: "CANCEL_TRANSACTION", //don't retry withdrawal and send cancel
    BLOCKED_TERRITORY: "BLOCKED_TERRITORY",
    SESSION_EXPIRED: "SESSION_EXPIRED",
};

const walletAdapters: {[key: string]: {new (): IWalletAdapter}} = {
    "standard": StandardWalletAdapter,
    "softswiss": SoftSwissWalletAdapter,
    "softswiss2": SoftSwiss2WalletAdapter,
    "openbox": OpenBoxWalletAdapter,
    "isoftbet": ISoftBetWalletAdapter,
    "playtech": PlaytechWalletAdapter,
    "relax": RelaxWalletAdapter,
    "lnw": LnwWalletAdapter,
    "qtech": QTechWalletAdapter,
    "betconstruct": BetConstructWalletAdapter,
    "reevo": ReevoWalletAdapter,
    "slotegrator": SlotegratorWalletAdapter,
    "fizzybubbly": FizzyBubblyWalletAdapter,
    "grrr": GrrrWalletAdapter,
    "slotify": SlotifyWalletAdapter,
    "badhombre": BadHombreWalletAdapter,
    "pinup": PinUpWalletAdapter,
    "alea": AleaWalletAdapter,
};

interface WalletEntry {
    adapter: IWalletAdapter;
    router: Router;
}

let walletEntries: Map<string, WalletEntry> = new Map();
let reloading = false;
let reloadPending = false;
let pendingRetries = 0;
const MAX_PENDING_RETRIES = 3;

interface CreateWalletResult {
    entry: WalletEntry;
    adapterName: string;
}

async function createWalletEntry(walletId: string): Promise<CreateWalletResult | null> {
    const wallet = await Wallet.getById(walletId);
    if (!wallet) {
        logger.warn(`Cannot load wallet ${walletId}: not found`);
        return null;
    }
    if (!wallet.enabled) {
        logger.debug(`Skipping disabled wallet ${walletId}`);
        return null;
    }
    if (!walletAdapters[wallet.adapter]) {
        logger.warn(`Cannot load wallet ${walletId}: adapter '${wallet.adapter}' not found`);
        return null;
    }

    const router = Router();
    const adapter = new walletAdapters[wallet.adapter]();
    await adapter.init(walletId, router, wallet.config, wallet.ips);

    return {entry: {adapter, router}, adapterName: wallet.adapter};
}

async function loadWallet(walletId: string): Promise<void> {
    const result = await createWalletEntry(walletId);
    if (result) {
        walletEntries.set(walletId, result.entry);
        logger.info(`Loaded wallet: ${walletId} (adapter: ${result.adapterName})`);
    }
}

async function reloadAll(isPendingRetry = false): Promise<void> {
    if (reloading) {
        reloadPending = true;
        logger.debug("Wallet reload already in progress, will reload again after completion");
        return;
    }
    reloading = true;
    if (!isPendingRetry) {
        pendingRetries = 0;
    }

    try {
        const currentWallets = await Wallet.find();
        const newEntries = new Map<string, WalletEntry>();
        const previousCount = walletEntries.size;

        // Build new map completely before swapping
        for (const wallet of currentWallets) {
            try {
                const result = await createWalletEntry(wallet.id);
                if (result) {
                    newEntries.set(wallet.id, result.entry);
                }
            } catch (e) {
                logger.error(`Failed to load wallet ${wallet.id} (adapter: ${wallet.adapter})`, {error: e});
            }
        }

        // Atomic swap - assign new map reference
        walletEntries = newEntries;

        logger.info(`Reloaded wallets: ${newEntries.size} loaded, ${previousCount} previous`);
    } finally {
        reloading = false;
        if (reloadPending) {
            reloadPending = false;
            if (pendingRetries < MAX_PENDING_RETRIES) {
                pendingRetries++;
                reloadAll(true).catch(e => logger.error("Error in pending wallet reload", {error: e}));
            } else {
                logger.warn("Max pending wallet reload retries reached, skipping");
            }
        }
    }
}

export async function getWalletAdapter(walletId: string): Promise<IWalletAdapter> {
    const wallet = await Wallet.getById(walletId);
    if (!wallet?.enabled) throw new Exception(`Wallet '${walletId}' is not enabled`);

    const entry = walletEntries.get(walletId);
    if (!entry) throw new Exception(`Couldn't find wallet adapter '${walletId}'`);

    return entry.adapter;
}

async function handleUnknownWallet(walletId: string, res: Response): Promise<void> {
    try {
        try {
            const wallet = await Wallet.getById(walletId);
            if (!wallet.enabled) {
                res.status(404).json({error: {code: "WALLET_DISABLED", message: `Wallet '${walletId}' is disabled`}});
                return;
            }
            res.status(404).json({error: {code: "WALLET_NOT_CONFIGURED", message: `Wallet '${walletId}' not configured`}});
        } catch {
            res.status(404).json({error: {code: "WALLET_NOT_FOUND", message: `Wallet '${walletId}' not found`}});
        }
    } catch (e) {
        logger.error(`Failed to check wallet status`, {error: e, walletId});
        if (!res.headersSent) {
            res.status(500).json({error: {code: "INTERNAL_ERROR", message: "Internal server error"}});
        }
    }
}

export async function initWalletApi(api: Express): Promise<void> {
    const mainRouter = Router();

    // Dynamic dispatch middleware - check memory first to reduce latency
    mainRouter.use("/:walletId", (req, res, next) => {
        const {walletId} = req.params;

        // First check memory map for fast path
        const entry = walletEntries.get(walletId);
        if (entry) {
            return entry.router(req, res, next);
        }

        // Not in map - check if it exists in DB but not loaded yet
        handleUnknownWallet(walletId, res);
    });

    api.use("/wallet", mainRouter);

    // Initial load of all wallets
    const wallets = await Wallet.getWallets();
    for (const wallet of wallets) {
        try {
            await loadWallet(wallet.id);
        } catch (e) {
            logger.error(`Failed to load wallet ${wallet.id} during startup`, {error: e});
        }
    }

    // Subscribe to invalidation events for hot-reload
    try {
        await redisPubSub.subscribe("invalidate/wallets", () => {
            logger.info("Wallet invalidation received, reloading wallets");
            reloadAll().catch(e => logger.error("Error reloading wallets", {error: e}));
        });
        logger.info("Subscribed to wallet invalidation events");
    } catch (e) {
        logger.error("Failed to subscribe to wallet invalidation events, service cannot start", {error: e});
        throw e;
    }
}
