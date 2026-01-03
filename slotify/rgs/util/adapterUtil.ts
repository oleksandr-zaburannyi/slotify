import * as crypto from "crypto";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import cache from "@slotify/shared/lib/cache";

export type IPlayerDetails = {
    wallet: string;
    operator: string;
    brand?: string;
    nickname?: string;
    nativeId: string;
    currency: string;
    jurisdiction?: string;
};

export type IRegulatory = {
    pt?: {
        "sm_result"?: string;
        "descr_ap"?: string;
        [key: string]: any;
    };
};

export interface ITransaction {
    type: "deposit" | "withdraw";
    amount: number;
    channel?: string;
    jackpotAmount?: number;
    provider?: string;
    game?: string;
    roundId?: string;
    category?: string;
    name?: string;
    roundFinished: boolean;
    campaignType?: string;
    campaignId?: string;
    variant?: string;
    winRatio?: number | null;
    ip?: string;
    regulatory?: IRegulatory;
}

export async function transactionRequest(rgsTransactionId: string, playerId: string, transaction: ITransaction, auto: boolean): Promise<{balance: number; popups?: IExceptionPopup[]; promo: any}> {
    const body = JSON.stringify({rgsTransactionId, ...transaction, playerId, auto});
    const headers = {
        "Content-Type": "application/json",
        "X-Server-Authorization": crypto.createHmac("sha256", process.env.ADAPTER_RGS_KEY!).update(body).digest("hex"),
    };
    const url = `${getServiceUrl("adapter")}/rgs/${process.env.RGS}/transaction`;
    const {balance, popups, promo} = await fetchAndParse(url, {method: "PUT", body, headers, timeout: 45 * 1000}, 0);
    return {balance, popups, promo};
}

export async function balanceRequest(playerId: string, provider: string, game: string): Promise<{balance: number}> {
    const params = {playerId, provider, game};
    const headers = {
        "Content-Type": "application/json",
        "X-Server-Authorization": crypto.createHmac("sha256", process.env.ADAPTER_RGS_KEY!).update("{}").digest("hex"),
    };
    const url = `${getServiceUrl("adapter")}/rgs/${process.env.RGS}/balance?${new URLSearchParams(params).toString()}`;
    const {balance} = await fetchAndParse(url, {method: "GET", headers}, 1);
    return {balance};
}

export async function cancelRoundRequest(roundId: string, auto: boolean): Promise<number> {
    const body = JSON.stringify({roundId, auto});
    const headers = {
        "Content-Type": "application/json",
        "X-Server-Authorization": crypto.createHmac("sha256", process.env.ADAPTER_RGS_KEY!).update(body).digest("hex"),
    };
    const url = `${getServiceUrl("adapter")}/rgs/${process.env.RGS}/cancel`;
    const {balance} = await fetchAndParse(url, {method: "DELETE", body, headers}, 0);
    return balance;
}

export async function cancelWithdrawRequest(rgsTransactionId: string, auto: boolean): Promise<number> {
    const body = JSON.stringify({rgsTransactionId, auto});
    const headers = {
        "Content-Type": "application/json",
        "X-Server-Authorization": crypto.createHmac("sha256", process.env.ADAPTER_RGS_KEY!).update(body).digest("hex"),
    };
    const url = `${getServiceUrl("adapter")}/rgs/${process.env.RGS}/cancel`;
    const {balance} = await fetchAndParse(url, {method: "DELETE", body, headers}, 0);
    return balance;
}

export function formatRoundRgsTransactionId(type: "win" | "bet", roundId: string, step?: number): string {
    if (type === "bet" && step === 0) return roundId + "_bet";
    if (type === "bet" && step !== 0) return roundId + "_sideBet_" + step;
    if (type === "win") return roundId + "_win";
    throw new Exception("Incorrect transaction type");
}

export function formatCommandRgsTransactionId(commandId: string): string {
    return commandId + "_command";
}

export function formatDrawWinRgsTransactionId(drawWinId: string): string {
    return drawWinId + "_drawWin";
}

export function shouldCancelOnWithdrawError(error: unknown) {
    const dontCancelCodes = ["INSUFFICIENT_FUNDS", "LOSS_LIMIT", "TIME_LIMIT", "TRANSACTION_FAILED", "TRANSACTION_REJECTED", "CLOSE_ROUND", "BLOCKED_TERRITORY", "SESSION_EXPIRED"];
    return !(error instanceof Exception && error.code && dontCancelCodes.includes(error.code));
}

export function shouldIgnoreDepositError(error: unknown) {
    const successfulDeposit = ["CLOSE_ROUND"];
    return error instanceof Exception && error.code && successfulDeposit.includes(error.code);
}

export function shouldIgnoreCancelError(error: unknown) {
    const successfulCancel = ["TRANSACTION_NOT_FOUND"];
    return error instanceof Exception && error.code && successfulCancel.includes(error.code);
}

export const getPlayerDetails = async (playerId: string): Promise<IPlayerDetails> => {
    const {wallet, operator, brand, nickname, nativeId, currency, jurisdiction} = await fetchAndParse(`${getServiceUrl("adapter")}/api/players/${playerId}`);
    return {wallet, operator, brand, nickname, nativeId, currency, jurisdiction};
};

export const blockPlayer = async (playerId: string): Promise<{wasBlocked?: boolean}> => {
    const {wasBlocked} = await fetchAndParse(`${getServiceUrl("adapter")}/api/players/${playerId}/block`, {method: "POST"});
    return {wasBlocked};
};

export const getCurrencies = cache(10 * 60, async (): Promise<{currency: string; rate: number}[]> => {
    const {currencies} = await fetchAndParse(`${getServiceUrl("adapter")}/api/currencies`);
    return currencies;
});
