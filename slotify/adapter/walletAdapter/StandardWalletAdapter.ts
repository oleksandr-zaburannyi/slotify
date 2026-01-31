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
import {getRgsAdapter} from "../rgsAdapter/rgsAdapter";
import {Game} from "../db/model/Game";
import {Rgs} from "../db/model/Rgs";
import {hmac} from "@slotify/shared/lib/middleware/hmac";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {body} from "express-validator";
import {ipFilter} from "../util/ip";
import {availableGames} from "../route/availableGames";
import launch from "../route/launch";

interface IConfig {
    url: string;
    secretKey: string;
    timeout?: number;
    transactionUsePost?: boolean;
    cancelUsePost?: string;
    overwriteGame?: string;
    useOriginalToken?: boolean;
    currencyAliasesPerBrand?: Record<string, Record<string, string>>;
    hostname?: string;
}

export class StandardWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    __debug: any;

    private fromWalletCurrency(walletCurrency: string, brand: string = ""): string {
        if (brand && this.config.currencyAliasesPerBrand?.[walletCurrency]?.[brand]) {
            return this.config.currencyAliasesPerBrand[walletCurrency][brand];
        }
        return walletCurrency;
    }

    private toWalletCurrency(currency: string, brand: string = "") {
        if (this.config.currencyAliasesPerBrand && brand) {
            for (const [walletCurrency, aliasesPerBrand] of Object.entries(this.config.currencyAliasesPerBrand)) {
                if (aliasesPerBrand[brand] === currency) {
                    return walletCurrency;
                }
            }
        }
        return currency;
    }

    async init(wallet: string, api: Express, path: string, config: IConfig, whitelistedIps?: string[]) {
        this.wallet = wallet;
        this.config = config;

        const mapToRgs = async (games: string[]) => {
            const {rgs, provider} = await Game.get(games[0]);
            const {adapter, config: rgsConfig} = await Rgs.getById(rgs);
            const rgsAdapter = getRgsAdapter(adapter);

            const rgsGames = [];
            for (const gameName of games) {
                const game = await Game.get(gameName);
                if (game.rgs !== rgs || game.provider !== provider) {
                    throw new Exception("All games need to be from the same provider and rgs", {
                        data: {
                            game,
                            provider,
                            rgs,
                        },
                    });
                }
                rgsGames.push(await Game.toRgs(gameName));
            }
            return {rgsAdapter, rgsConfig, rgsGames};
        };

        api.post(
            path + "/freeBets/add",
            ipFilter(whitelistedIps),
            hmac(config.secretKey),
            validate([
                body("walletCampaignId").isString().exists(),
                body("games").isArray().exists(),
                body("nativeIds").isArray().exists(),
                body("start").isInt().optional(),
                body("end").isInt().optional(),
                body("bets").isInt().exists(),
                body("amount").isFloat().exists(),
                body("currency").isString().exists(),
                body("operator").isString().exists(),
                body("brand").isString().exists(),
            ]),
            async (req, res) => {
                const {walletCampaignId, games, nativeIds, start, end, bets, amount, operator, brand} = req.body;
                const currency = this.fromWalletCurrency(req.body.currency, brand);

                const {rgsAdapter, rgsConfig, rgsGames} = await mapToRgs(games);

                if (!rgsAdapter.addFreeBets) {
                    throw new Exception("Free Bets API is not supported for the specified games", {data: {games}});
                }

                res.json(
                    await rgsAdapter.addFreeBets(
                        {
                            walletCampaignId,
                            games: rgsGames,
                            nativeIds,
                            start,
                            end,
                            bets,
                            amount,
                            currency,
                        },
                        rgsConfig,
                        wallet,
                        operator,
                        brand,
                    ),
                );
            },
        );

        api.post(
            path + "/freeBets/remove",
            ipFilter(whitelistedIps),
            hmac(config.secretKey),
            validate([body("walletCampaignId").isString().exists(), body("operator").isString().exists(), body("brand").isString().exists(), body("games").isArray().exists()]),
            async (req, res) => {
                const {walletCampaignId, games, operator, brand} = req.body;

                const {rgsAdapter, rgsConfig} = await mapToRgs(games);

                if (!rgsAdapter.removeFreeBets) {
                    throw new Exception("Free Bets API is not supported for the specified games", {data: {games}});
                }

                res.json(await rgsAdapter.removeFreeBets(walletCampaignId, rgsConfig, wallet, operator, brand));
            },
        );

        api.post(
            path + "/freeBets/availableBets",
            ipFilter(whitelistedIps),
            hmac(config.secretKey),
            validate([body("games").isArray().exists(), body("currencies").isArray().exists(), body("operator").isString().exists(), body("brand").isString().exists()]),
            async (req, res) => {
                const {games, operator, brand} = req.body;
                const currencies = req.body.currencies.map((currency: string) => this.fromWalletCurrency(currency, brand));

                const {rgsAdapter, rgsConfig, rgsGames} = await mapToRgs(games);

                if (!rgsAdapter.availableBets) {
                    throw new Exception("Free Bets API is not supported for the specified games", {data: {games}});
                }

                res.json(await rgsAdapter.availableBets({games: rgsGames, currencies}, rgsConfig, wallet, operator, brand));
            },
        );

        api.post(path + "/availableGames", ipFilter(whitelistedIps), hmac(config.secretKey), validate([body("operator").isString().optional({nullable: true}), body("brand").isString().optional({nullable: true})]), async (req, res) => {
            const operator = req.body.operator;
            const brand = req.body.brand;
            res.json(await availableGames(this.wallet, operator, brand));
        });

        api.post(path + "/launch/:mode", ipFilter(whitelistedIps), hmac(config.secretKey), validate([]), async (req, res) => {
            const mode = req.params.mode as "real" | "fun" | "replay";
            res.json({url: await launch(mode, {...req.body, hostname: config.hostname})});
        });
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
        const {nativeId, token, balance, country, brand, nickname, gender, jurisdiction, sessionData, campaignTypes} = data;
        const currency = this.fromWalletCurrency(data.currency, brand);

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
        const {id, nativeId, operator, currency} = player;
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
            walletCampaignId: transaction.walletCampaignId,
            campaignData: transaction.campaignData,
            regulatory: transaction.regulatory,
            ip: transaction.ip,
            currency: this.toWalletCurrency(currency, player.brand),
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
