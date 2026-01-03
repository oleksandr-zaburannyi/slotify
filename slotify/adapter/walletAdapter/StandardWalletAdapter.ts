import Exception from "@slotify/shared/lib/Exception";
import * as crypto from "crypto";
import fetch from "@slotify/shared/lib/fetch";
import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletTransaction} from "./IWalletAdapter";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import {Express} from "express";
import logger from "@slotify/shared/lib/logger";
import {correlationData} from "@slotify/shared/lib/asyncContext";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {errorCodes} from "./walletAdapter";

interface IConfig {
    url: string;
    secretKey: string;
    timeout?: number;
    transactionUsePost?: boolean;
    cancelUsePost?: string;
    overwriteGame?: string;
    useOriginalToken?: boolean;
}

export class StandardWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    __debug: any;

    async init(wallet: string, api: Express, path: string, config: any) {
        this.wallet = wallet;
        this.config = config;
    }

    private getUrl(params: Record<string, string>) {
        let url = this.config.url;
        for (const key in params) {
            url = url.replace(new RegExp("\\${" + key + "}", "g"), params[key]);
        }
        return url;
    }

    private async fetch(url: string, method: string, params: any, token: string | null = null): Promise<any> {
        let retry = 1;
        do {
            let json;
            const body = params ? JSON.stringify(params) : undefined;
            const headers: Record<string, string> = {...correlationData};
            headers["Content-Type"] = "application/json";
            headers["X-Server-Authorization"] = crypto
                .createHmac("sha256", this.config.secretKey)
                .update(body ? body : "")
                .digest("hex");
            if (token) {
                headers["Authorization"] = "Bearer " + token;
            }
            let text;
            try {
                this.__debug = isDevMode() && {url, method, body, headers};
                const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
                text = await response.text();

                const responseHeaders: string[][] = [];
                response.headers.forEach((headerValue: string, headerKey: string) => responseHeaders.push([headerKey, headerValue]));

                this.__debug = isDevMode() && {...this.__debug, status: response.status, text, responseHeaders};
                json = JSON.parse(text);
            } catch (e) {
                if (retry === 0) {
                    throw new Exception("Couldn't fetch from wallet", {code: "NETWORK_ERROR", data: {error: e, rawResponseText: text}});
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text});
            }
            if (json?.error) {
                const code = Object.keys(errorCodes).includes(json.error.code) ? json.error.code : errorCodes.UNKNOWN;
                if (code !== errorCodes.UNKNOWN || retry === 0) {
                    throw new Exception("Wallet returned error", {code, data: {error: json.error}});
                }
            } else if (json) {
                return json;
            }
        } while (--retry >= 0);
    }

    async authenticate(key: string, operator: string, provider: string, game: string, ip?: string, channel?: "desktop" | "mobile") {
        const wallet = this.wallet;
        const url = this.getUrl({operator});
        const data = await this.fetch(url + "/authenticate", "POST", {key, operator, wallet, provider, game: this.config.overwriteGame || game, ip, channel});
        const {nativeId, token, currency, balance, country, brand, nickname, gender, jurisdiction, sessionData, campaignTypes} = data;

        if (!nativeId) throw new Exception("Incorrect nativeId returned", {data: {data, key, wallet, operator, game, nativeId}});
        if (!token) throw new Exception("Incorrect token returned", {data: {data, token, key, wallet, operator, game}});
        if (!currency) throw new Exception("Incorrect currency returned", {data: {data, currency, key, wallet, operator, game}});
        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, key, wallet, operator, game}});
        if (campaignTypes && (!Array.isArray(campaignTypes) || campaignTypes.find(campaignType => typeof campaignType !== "string"))) throw new Exception("Incorrect campaignTypes returned", {data: {data, campaignTypes}});

        return {nativeId, token, currency, balance, country, brand, nickname, gender, jurisdiction, sessionData, campaignTypes};
    }

    async balance(player: Player, provider: string, game: string, {token}: ISession) {
        const {id: playerId, nativeId, operator} = player;
        const url = this.getUrl({operator});
        const data = await this.fetch(url + "/balance", "POST", {nativeId, playerId, provider, game: this.config.overwriteGame || game}, token);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});

        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession, originalSession: ISession | null) {
        const {id, nativeId, operator} = player;
        const token = originalSession && this.config.useOriginalToken ? originalSession?.token : session.token;

        const requestParams = clearEmpty({
            nativeId,
            playerId: id,
            transactionId: transaction.transactionId,
            type: transaction.type,
            provider: transaction.provider,
            amount: transaction.amount,
            jackpotAmount: transaction.jackpotAmount,
            game: this.config.overwriteGame || transaction.game,
            roundId: transaction.roundId,
            roundFinished: transaction.roundFinished,
            category: transaction.category,
            name: transaction.name,
            campaignType: transaction.campaignType,
            campaignId: transaction.campaignId,
            campaignData: transaction.campaignData,
            regulatory: transaction.regulatory,
            ip: transaction.ip,
        });

        const method = this.config.transactionUsePost ? "POST" : "PUT";
        const url = this.getUrl({operator});
        const data = await this.fetch(url + "/transaction", method, requestParams, token);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, walletTransaction: transaction}});

        return {balance};
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession, originalSession: ISession | null) {
        const {id: playerId, nativeId, operator} = player;
        const token = originalSession && this.config.useOriginalToken ? originalSession?.token : session.token;
        const method = this.config.cancelUsePost ? "POST" : "DELETE";
        const url = this.getUrl({operator});
        const {transactionId, roundId} = transaction;
        const data = await this.fetch(url + "/cancel", method, {transactionId, nativeId, playerId, roundId}, token);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transactionId}});

        return {balance};
    }
}

export default StandardWalletAdapter;
