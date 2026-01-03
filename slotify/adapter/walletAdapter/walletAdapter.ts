import Exception from "@slotify/shared/lib/Exception";
import {Wallet} from "../db/model/Wallet";
import IWalletAdapter from "./IWalletAdapter";
import StandardWalletAdapter from "./StandardWalletAdapter";
import {Express} from "express";
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
const walletInstances: {[key: string]: IWalletAdapter} = {};
const walletsPerAdapter: Record<string, string[]> = {};

export async function getWalletAdapter(walletId: string): Promise<IWalletAdapter> {
    if (!(await Wallet.getWallets()).find(wallet => wallet.id === walletId)?.enabled) throw new Exception(`Wallet '${walletId}' is not enabled`);
    if (!walletInstances[walletId]) throw new Exception(`Couldn't find wallet adapter '${walletId}'`);
    return walletInstances[walletId];
}

export async function initWalletApi(api: Express): Promise<void> {
    const wallets = await Wallet.getWallets();

    for (const {id, adapter, config, ips} of wallets) {
        if (!walletAdapters[adapter]) {
            logger.warn(`Couldn't find wallet adapter ${adapter}`);
            continue;
        }

        const walletAdapter = new walletAdapters[adapter]();

        await walletAdapter.init(id, api, `/wallet/${id}`, config, ips);
        walletInstances[id] = walletAdapter;
        walletsPerAdapter[adapter] ||= [];
        walletsPerAdapter[adapter].push(id);
    }
}
