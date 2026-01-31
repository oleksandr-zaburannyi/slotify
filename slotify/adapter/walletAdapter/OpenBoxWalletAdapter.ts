import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {Router, Request} from "express";
import {correlationData} from "@slotify/shared/lib/asyncContext";
import Exception from "@slotify/shared/lib/Exception";
import logger from "@slotify/shared/lib/logger";
import fetch from "@slotify/shared/lib/fetch";
import openBoxEncrypt from "./openbox/openBoxEncrypt";
import {openBoxCurrencies} from "./openbox/openBoxCurrencies";
import {fromOpenBoxFormat, toOpenBoxFormat} from "./openbox/OpenBoxMoneyConverter";
import {openboxInterfaceTypeCode, openBoxMethodCodes} from "./openbox/OpenBoxApiCodes";
import Cipher from "@slotify/shared/lib/Cipher";
import launch from "../route/launch";
import {errorCodes} from "./walletAdapter";

type ILauncherQueryParams = {
    "token": string;
    "agency-uid": string;
    "player-uid": string;
    "player-type": string;
    "player-id": string;
    "game-id": string;
    "currency": string;
    "country": string;
    "language": string;
    "backurl": string;
};

type IStaticGameHistoryParams = {
    "playerId": string;
    "gameId": string;
    "gameCycleId": string;
    "localeCode": string;
    "superDomain": string;
};

interface IConfig {
    url: string;
    secretKey: string;
    vendorUid: string;
    timeout?: number;
}

const operator = "openbox";

export class OpenBoxWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    cipher!: Cipher;

    async init(wallet: string, router: Router, config: any) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        router.get("/launcher", async (req: Request<unknown, unknown, unknown, ILauncherQueryParams>, res) => {
            const key = req.query["token"];
            const brand = req.query["agency-uid"];
            const game = req.query["game-id"];
            const language = req.query["language"];
            const lobbyUrl = req.query["backurl"];
            const country = req.query["country"]?.toLowerCase();

            const encryptedUrlKey = this.cipher.encrypt(JSON.stringify({key, brand, country}));

            try {
                const launchUrl = await launch("real", {wallet, operator, lobbyUrl, language, game, key: encryptedUrlKey}, req);
                res.redirect(launchUrl);
            } catch (e) {
                if (e instanceof Exception) {
                    res.status(400).json({code: e.code, message: e.message});
                    return;
                }
                throw e;
            }
        });

        router.get("/sgh", async (req: Request<unknown, unknown, unknown, IStaticGameHistoryParams>, res) => {
            try {
                const game = req.query.gameId;
                const roundId = req.query.gameCycleId;
                const language = req.query.localeCode;

                const launchUrl = await launch("replay", {wallet, operator, language, game, roundId}, req);
                res.redirect(launchUrl);
            } catch (e) {
                if (e instanceof Exception) {
                    res.status(400).json({code: e.code, message: e.message});
                    return;
                }
                throw e;
            }
        });
    }

    async authenticate(encryptedUrlKey: string): Promise<IWalletAuthenticate> {
        const {key, brand, country} = JSON.parse(this.cipher.decrypt(encryptedUrlKey));

        // verify player
        const verifyPlayerRequestPayload = {token: key};
        const verifyPlayerResponseBody = await this.fetch(openBoxMethodCodes.verifyPlayer, verifyPlayerRequestPayload);
        const {token} = this.tryParsePayload(verifyPlayerResponseBody);

        // get player information
        const playerInformationRequestPayload = {token};
        const playerInformationResponseBody = await this.fetch(openBoxMethodCodes.playerInformation, playerInformationRequestPayload);
        const {member_account, member_uid, currency_code} = this.tryParsePayload(playerInformationResponseBody);

        const nativeId = member_uid;
        let currency;
        try {
            currency = openBoxCurrencies[currency_code].toLowerCase();
        } catch {
            throw new Exception("Wallet returned incorrect currency_code");
        }
        const nickname = member_account;

        // balance
        const balance = await this.fetchBalance(token);

        return {nativeId, token, currency, balance, country, brand, nickname};
    }

    async balance(player: Player, provider: string, game: string, {token}: ISession): Promise<IWalletBalance> {
        const balance = await this.fetchBalance(token);

        return {balance};
    }

    private async fetchBalance(token: string): Promise<number> {
        const balanceRequestPayload = {token};
        const balanceResponseBody = await this.fetch(openBoxMethodCodes.balance, balanceRequestPayload);

        const {balance} = this.tryParsePayload(balanceResponseBody);

        return fromOpenBoxFormat(balance);
    }

    async transaction(player: Player, transaction: IWalletTransaction, {token}: ISession): Promise<IWalletBalance> {
        const transactionRequestPayload = {
            token,
            game_uid: transaction.game,
            order_uid: transaction.transactionId,
            game_cycle_uid: transaction.roundId,
            order_type: transaction.type === "withdraw" ? 3 : 4,
            order_amount: toOpenBoxFormat(transaction.amount),
        };

        const transactionResponseBody = await this.fetch(openBoxMethodCodes.transaction, transactionRequestPayload);

        const {balance} = this.tryParsePayload(transactionResponseBody);
        return {balance: fromOpenBoxFormat(balance)};
    }

    async cancel(player: Player, transaction: IWalletTransaction, {token}: ISession): Promise<IWalletBalance> {
        const cancelRequestPayload = {
            token,
            game_uid: transaction.game,
            order_uid: "rollback_" + transaction.transactionId,
            game_cycle_uid: transaction.roundId,
            order_uid_cancel: transaction.transactionId,
        };
        const cancelResponseBody = await this.fetch(openBoxMethodCodes.cancel, cancelRequestPayload);
        const {balance} = this.tryParsePayload(cancelResponseBody);

        return {balance: fromOpenBoxFormat(balance)};
    }

    private async fetch(methodCode: string, payloadToEncrypt?: any): Promise<any> {
        const encryptedPayload = payloadToEncrypt ? openBoxEncrypt(JSON.stringify(payloadToEncrypt), this.config.secretKey) : undefined;

        const params = {
            type: openboxInterfaceTypeCode,
            method: methodCode,
            vendor_uid: this.config.vendorUid,
            timestamp: Date.now(),
            payload: encryptedPayload,
        };

        const url = this.config.url;
        const method = "POST";
        const body = JSON.stringify(params);
        const headers: Record<string, string> = {...correlationData};
        headers["Content-Type"] = "application/json";

        let json;
        let text;
        try {
            const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
            text = await response.text();
            json = JSON.parse(text);
        } catch (e) {
            throw new Exception("Couldn't fetch from wallet", {code: "NETWORK_ERROR", data: {error: e}});
        } finally {
            logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text, unencryptedPayload: payloadToEncrypt});
        }
        return json;
    }

    private mapOpenBoxError(openBoxErrorCode: number): string {
        switch (openBoxErrorCode) {
            case 2:
                return errorCodes.PLAYER_UNAUTHORIZED;
            case 1019:
                return errorCodes.INSUFFICIENT_FUNDS;
            default:
                return errorCodes.UNKNOWN;
        }
    }

    private tryParsePayload(responseBody: any): any {
        if (responseBody.is_success) {
            try {
                return JSON.parse(responseBody.payload);
            } catch {
                throw new Exception("Couldn't parse wallet response payload");
            }
        } else {
            const code = this.mapOpenBoxError(responseBody.error_code);
            throw new Exception("Wallet responded with error", {code});
        }
    }
}

export default OpenBoxWalletAdapter;
