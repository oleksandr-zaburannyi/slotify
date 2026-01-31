import {Router, NextFunction, Request, Response} from "express";
import {check} from "express-validator";
import {DateTime} from "../util/luxon";
import Exception from "@slotify/shared/lib/Exception";
import {validate} from "@slotify/shared/lib/middleware/validate";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import logger from "@slotify/shared/lib/logger";
import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletTransaction} from "./IWalletAdapter";
import launch from "../route/launch";
import {Transaction} from "../db/model/Transaction";
import {Game} from "../db/model/Game";
import {errorCodes} from "./walletAdapter";
import {createCampaign, getCampaignByName, getFreeBetsCampaignDetails} from "../util/external";

interface IConfig {
    includeProviderInGame?: boolean;
    url: string;
    secretKey: string;
    gameLaunchPassKey: string;
    gameResultPassKey: string;
    timeout?: number;
    currencyAliases?: Record<string, string>;
    currencyAliasesPerBrand?: Record<string, Record<string, string>>;
}

const failedTransactionErrorCodes: string[] = ["REQUEST_DECLINED", "INVALID_TOKEN", "ACCOUNT_BLOCKED", "LOGIN_FAILED"];

const operator = "qtech";

export class QTechWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;

    private cipher?: Cipher;

    private validateServer(req: Request, res: Response, next: NextFunction) {
        const isReplayUrl = req.originalUrl.includes("replay");
        const isLaunch = req.headers["game-launch-pass-key"] === this.config.gameLaunchPassKey && !isReplayUrl;
        const isReplay = req.headers["game-result-pass-key"] === this.config.gameResultPassKey && isReplayUrl;

        if (isLaunch || isReplay) {
            return next();
        }

        res.status(403).json({code: errorCodes.SERVER_UNAUTHORIZED, message: "Couldn't authorize the server"});
    }

    private parseLanguage = (language: string) => language.toLowerCase().split("_");

    private fromWalletCurrency(walletCurrency: string, brand?: string): string {
        if (brand && this.config.currencyAliasesPerBrand?.[walletCurrency]?.[brand]) {
            return this.config.currencyAliasesPerBrand[walletCurrency][brand];
        }
        if (this.config.currencyAliases?.[walletCurrency]) {
            return this.config.currencyAliases[walletCurrency];
        }
        return walletCurrency;
    }

    private toWalletCurrency(currency: string, brand?: string): string {
        if (this.config.currencyAliasesPerBrand && brand) {
            for (const [walletCurrency, aliasesPerBrand] of Object.entries(this.config.currencyAliasesPerBrand)) {
                if (aliasesPerBrand[brand] === currency) {
                    return walletCurrency;
                }
            }
        }
        if (this.config.currencyAliases) {
            for (const [walletCurrency, alias] of Object.entries(this.config.currencyAliases)) {
                if (alias === currency) {
                    return walletCurrency;
                }
            }
        }
        return currency;
    }

    async init(wallet: string, router: Router, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        // wallet/qtech/launch
        router.post(
            "/launch",
            this.validateServer.bind(this),
            validate([
                check("mode").isIn(["demo", "real"]),
                check("operatorId").isString().exists().isLength({max: 255}),
                check("playerId").isString().exists().isLength({max: 255}),
                check("gameId").isString().exists().isLength({max: 255}),
                check("currency").isString().exists().isLength({max: 255}),
                check("language").isString().exists().isLength({max: 255}),
                check("device").isString().exists().isLength({max: 255}),
                check("sessionToken").if(check("mode").equals("real")).isString().exists().isLength({max: 255}),
                check("jurisdiction")
                    .isString()
                    .optional()
                    .customSanitizer(value => (value ? value : ""))
                    .isLength({max: 255}),
                check("tableId")
                    .isString()
                    .optional()
                    .customSanitizer(value => (value ? value : ""))
                    .isLength({max: 255}),
                check("betLimitCode")
                    .isString()
                    .optional()
                    .customSanitizer(value => (value ? value : ""))
                    .isLength({max: 255}),
                check("displayName")
                    .isString()
                    .optional()
                    .customSanitizer(value => (value ? value : ""))
                    .isLength({max: 255}),
                check("returnUrl")
                    .isString()
                    .optional()
                    .customSanitizer(value => (value ? value : ""))
                    .isLength({max: 1024}),
            ]),
            async (req, res) => {
                const brand = req.body.operatorId;
                const game = Game.removeProviderPrefix(config, req.body.gameId);
                const mode = req.body.mode === "demo" ? "fun" : "real";
                const currency = this.fromWalletCurrency(req.body.currency, brand).toLowerCase();
                const device = req.body.device;
                const jurisdiction = req.body.jurisdiction?.toLowerCase();
                const nativeId = req.body.playerId;
                const nickname = req.body.displayName;
                const lobbyUrl = req.body.returnUrl;
                const [language, country] = this.parseLanguage(req.body.language);
                const realMode = mode === "real";
                const key = this.cipher!.encrypt(
                    JSON.stringify({
                        nativeId,
                        currency,
                        jurisdiction,
                        language,
                        country,
                        nickname,
                        device,
                        brand,
                        timestamp: Date.now(),
                        token: req.body.sessionToken || "",
                    }),
                );

                const url: string = await launch(mode, {wallet: this.wallet, operator, theme: brand, lobbyUrl, language, game, key: realMode ? key : ""}, req);
                res.json({url});
            },
        );

        // wallet/qtech/launch/replay
        router.post(
            "/launch/replay",
            this.validateServer.bind(this),
            validate([check("operatorId").isString().exists().isLength({max: 255}), check("roundId").isString().exists().isLength({max: 255}), check("gameId").isString().exists().isLength({max: 255})]),
            async (req, res) => {
                const roundId = req.body.roundId;
                const game = Game.removeProviderPrefix(config, req.body.gameId);

                const url: string = await launch("replay", {wallet: this.wallet, operator, game, roundId}, req);
                res.json({url});
            },
        );
    }

    private getCipherData = (key: string) => {
        let decrypted;
        try {
            decrypted = JSON.parse(this.cipher!.decrypt(key));
        } catch {
            throw new Exception("Incorrect authentication key", {data: {key, wallet: this.wallet}});
        }
        return decrypted;
    };

    private async fetch(path: string, method: string, params: any, token?: string): Promise<any> {
        const body = params ? JSON.stringify(params) : undefined;
        const headers: Record<string, string> = {};
        headers["Content-Type"] = "application/json";
        headers["Pass-Key"] = this.config.secretKey;
        if (token) headers["Session-Token"] = token;

        let json;
        let text;
        const url = `${this.config.url}${path}`;
        try {
            const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
            text = await response.text();
            json = JSON.parse(text);
        } catch (e) {
            throw new Exception("Couldn't fetch from wallet", {code: "NETWORK_ERROR", data: {error: e}});
        } finally {
            logger.info(`Wallet outgoing call (${this.wallet}): ${path}`, {req: params, res: json || text});
        }
        if (json.code) {
            if (json.code === "INSUFFICIENT_FUNDS") {
                throw new Exception(json.message, {code: errorCodes.INSUFFICIENT_FUNDS});
            } else if (json.code === "LIMIT_EXCEEDED") {
                throw new Exception(json.message, {code: errorCodes.LOSS_LIMIT});
            } else if (json.code === "ACCOUNT_BLOCKED") {
                throw new Exception(json.message, {code: errorCodes.PLAYER_UNAUTHORIZED});
            } else if (json.code === "LOGIN_FAILED") {
                throw new Exception(json.message, {code: errorCodes.PLAYER_UNAUTHORIZED});
            } else if (json.code === "INVALID_TOKEN") {
                throw new Exception(json.message, {code: errorCodes.PLAYER_UNAUTHORIZED});
            } else if (json.code === "REQUEST_DECLINED") {
                throw new Exception(json.message, {code: errorCodes.UNKNOWN});
            } else if (failedTransactionErrorCodes.includes(json.code)) {
                throw new Exception(json.message, {code: errorCodes.TRANSACTION_FAILED});
            }
            throw new Exception(`Wallet returned error (${this.wallet})`, {
                data: {message: json.message, request: {url, params}, response: text},
                code: json.code,
            });
        }
        return json;
    }

    async authenticate(key: string, operator: string, provider: string, game: string, ip: string): Promise<IWalletAuthenticate> {
        const {currency, brand, jurisdiction, country, nickname, token} = this.getCipherData(key);

        const data = await this.fetch("/token", "POST", {gameId: Game.addProviderPrefix(this.config, provider!, game!), ipAddress: ip}, token);

        const {playerId: nativeId, balance, bonuses, maxBetAmount} = data;
        const incomingCurrency = this.fromWalletCurrency(data.currency, brand).toLowerCase();
        const hasBonuses = bonuses && bonuses.length > 0;

        if (!nativeId) throw new Exception("Incorrect nativeId returned", {data: {data, key, wallet: this.wallet, operator, brand, game, nativeId}});
        if (!currency || !incomingCurrency)
            throw new Exception("Incorrect currency returned", {
                data: {data, currency: currency || incomingCurrency, key, wallet: this.wallet, operator, brand, game},
            });
        if (incomingCurrency !== currency)
            throw new Exception("Player currency does not match incoming currency", {
                data: {data, currency, incomingCurrency, key, wallet: this.wallet, operator, brand, game},
            });
        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, key, wallet: this.wallet, operator, brand, game}});

        // promo
        if (hasBonuses) {
            for (const bonus of bonuses) {
                const name = `qtech_${bonus.promoCode}`;
                const bets = bonus.numberOfRounds;
                const amount = bonus.betAmountPerRound;
                const wallets = [this.wallet];
                const nativeIds = [nativeId];
                const games = [game];
                const end = DateTime.utc().startOf("day").plus({days: bonus.validityInDays}).toMillis();

                if (!(await getCampaignByName(name))) {
                    await createCampaign({type: "freeBets", name, end, wallets, nativeIds, games, config: {bets, amount, currency}});
                }
            }
        }
        return {nativeId, token: token || key, country, balance, currency, jurisdiction, nickname, brand, sessionData: {betConfig: {maxBet: maxBetAmount}}};
    }

    async balance(player: Player, provider: string, game: string, {token}: ISession) {
        const {nativeId} = player;

        const data = await this.fetch(`/players/${encodeURIComponent(nativeId)}/balance`, "GET", null, token);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});

        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession) {
        const {nativeId, currency} = player;
        const {token} = session;
        const {transactionId, roundId, amount, provider, game, roundFinished, type, campaignType} = transaction;
        const isDeposit = type === "deposit";
        const isFreeBets = campaignType === "freeBets";
        // for free spins we do deposit calls only
        const skipWithdrawalForFreeBets = isFreeBets && !isDeposit;

        if (skipWithdrawalForFreeBets) {
            if (!game) throw new Exception("'game' is not available on transaction", {data: {nativeId, transaction}});
            logger.info(`Skip 'withdrawal' ${this.wallet} wallet call for transaction id: ${transactionId} with campaignType: ${campaignType} and request balance instead`, {transaction});
            return await this.balance(player, provider!, game, session);
        }

        // get exact transaction time
        const transactionInfo = await Transaction.findOneBy({id: transactionId});
        if (!transactionInfo) throw new Exception("Failed to load transaction", {data: {nativeId, transaction}});

        let betId = "";
        if (isDeposit) {
            const withdrawalTransaction = await Transaction.findOneOrFail({where: {roundId, type: "withdraw"}, order: {createdAt: "ASC"}});
            betId = withdrawalTransaction.id;
        }

        let promoCode = "";
        if (isFreeBets) {
            const campaign = await getFreeBetsCampaignDetails(transaction.campaignId!);
            if (!campaign) throw new Exception("Couldn't find campaign name", {data: {transaction}});
            promoCode = campaign.name.split("_")[1];
        }

        const params = {
            txnId: transactionId,
            ...(betId && isDeposit && {betId}),
            ...(isFreeBets && isDeposit && {promoCode, bonusType: "FREE_ROUND"}),
            playerId: nativeId,
            roundId: roundId,
            amount: amount,
            currency: this.toWalletCurrency(currency, player.brand).toUpperCase(),
            gameId: Game.addProviderPrefix(this.config, provider!, game!),
            created: transactionInfo.createdAt,
            completed: roundFinished,
        };

        const url = transaction.type === "withdraw" ? "withdrawal" : "deposit";
        const data = await this.fetch(`/${url}`, "POST", params, token);

        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

        return {balance};
    }

    async cancel(player: Player, transaction: IWalletTransaction, {token}: ISession) {
        const {transactionId, game, roundId, amount, provider, createdAt} = transaction;
        const {nativeId, currency} = player;

        const params = {
            txnId: "rollback_" + transactionId,
            betId: transactionId,
            playerId: nativeId,
            roundId: roundId,
            amount: amount,
            currency: this.toWalletCurrency(currency, player.brand).toUpperCase(),
            gameId: Game.addProviderPrefix(this.config, provider!, game!),
            created: createdAt,
            completed: true,
        };

        const data = await this.fetch(`/rollback`, "POST", params, token);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

        return {balance};
    }
}

export default QTechWalletAdapter;
