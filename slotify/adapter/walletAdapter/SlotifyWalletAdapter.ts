import Exception from "@slotify/shared/lib/Exception";
import * as crypto from "crypto";
import fetch from "@slotify/shared/lib/fetch";
import {Express} from "express";
import IWalletAdapter, {IWalletAuthenticate, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {Player} from "../db/model/Player";
import logger from "@slotify/shared/lib/logger";
import {errorCodes} from "./walletAdapter";

type IAuthenticateReuqest = {
    wallet: string;
    operator: string;
    key: string;
    provider: string;
    game: string;
    ip?: string;
};
type IAuthenticateResponse = {
    playerId: string;
    nativeId: string;
    balance: number;
    currency: string;
    brand?: string;
    nickname?: string;
    gender?: string;
    country?: string;
    jurisdiction?: string;
    sessionId: string;
};
type IBalanceRequest = {
    playerId: string;
    provider: string;
    game: string;
};
type IBalanceResponse = {
    balance: number;
};
type ICancelRequest = {
    roundId?: string;
    rgsTransactionId?: string;
    auto?: boolean;
};
type ICancelResponse = {
    balance: number;
};
type ITransactionRequest = {
    playerId: string;
    rgsTransactionId: string;
    type: "deposit" | "withdraw";
    amount: number;
    jackpotAmount?: number;
    provider?: string;
    game?: string;
    roundId: string;
    roundFinished: boolean;
    category?: string;
    name?: string;
    channel?: string;
    ip?: string;
};
type ITransactionResponse = {
    balance: number;
};

interface IConfig {
    url: string;
    secretKey: string;
    timeout?: number;
}

export class SlotifyWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;

    private calculateChecksum(method: string, body: string) {
        return crypto
            .createHmac("sha256", this.config.secretKey)
            .update(method === "GET" ? "{}" : body)
            .digest("hex");
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
    }

    private async fetch<IParams, IResponse>(path: string, method: string, params: IParams): Promise<IResponse> {
        let retry = 1;
        do {
            const body = JSON.stringify(params);
            const headers = {
                "Content-Type": "application/json",
                "X-Server-Authorization": this.calculateChecksum(method, body),
            };

            let json;
            let text;
            const searchParams = method === "GET" ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
            const url = `${this.config.url}${path}${searchParams}`;
            try {
                const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
                text = await response.text();
                json = JSON.parse(text);
                if (json && !json.error) return json;
                if (retry === 0) {
                    const code = json?.error?.code || errorCodes.UNKNOWN;
                    const message = json?.error?.message || "Couldn't fetch from wallet";
                    throw new Exception(message, {code, data: {json, text}});
                }
            } catch (error) {
                if (retry === 0) {
                    throw new Exception("Couldn't fetch from wallet", {code: errorCodes.UNKNOWN, data: {error}});
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text});
            }
        } while (--retry >= 0);
        throw new Exception("Unexpected error");
    }

    async authenticate(key: string, operator: string, provider: string, game: string, ip?: string): Promise<IWalletAuthenticate> {
        const [endWallet, endOperator] = operator.split(":");
        const params = {
            wallet: endWallet,
            key,
            operator: endOperator,
            provider,
            game,
            ip,
        };
        const {balance, playerId, currency, jurisdiction, country, brand, nickname, gender, sessionId} = await this.fetch<IAuthenticateReuqest, IAuthenticateResponse>("/authenticate", "POST", params);

        return {balance, token: sessionId, brand, country, jurisdiction, currency, nativeId: playerId, gender, nickname};
    }

    async balance(player: Player, provider: string, game: string): Promise<IWalletBalance> {
        const params = {
            playerId: player.nativeId,
            provider,
            game,
        };
        const data = await this.fetch<IBalanceRequest, IBalanceResponse>("/balance", "GET", params);
        const {balance} = data;

        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction) {
        const params = {
            playerId: player.nativeId,
            provider: transaction.provider,
            game: transaction.game,
            type: transaction.type,
            amount: transaction.amount,
            jackpotAmount: transaction.jackpotAmount,
            category: transaction.category,
            roundId: transaction.roundId,
            roundFinished: transaction.roundFinished,
            rgsTransactionId: transaction.transactionId,
            name: transaction.name,
            channel: transaction.channel,
        };
        const data = await this.fetch<ITransactionRequest, ITransactionResponse>("/transaction", "PUT", params);
        const {balance} = data;

        return {balance};
    }

    async cancel(player: Player, transaction: IWalletTransaction) {
        const params = {
            rgsTransactionId: transaction.transactionId,
            auto: transaction.auto,
        };
        const data = await this.fetch<ICancelRequest, ICancelResponse>("/cancel", "DELETE", params);
        const {balance} = data;

        return {balance};
    }
}

export default SlotifyWalletAdapter;
