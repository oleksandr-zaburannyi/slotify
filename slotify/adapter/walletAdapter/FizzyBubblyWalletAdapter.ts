/**
 * FizzyBubbly wallet adapter
 */
import {Router, NextFunction, Request, Response} from "express";
import {check} from "express-validator";
import {gql} from "graphql-request";
import * as crypto from "crypto";
import Exception from "@slotify/shared/lib/Exception";
import {validate} from "@slotify/shared/lib/middleware/validate";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import logger from "@slotify/shared/lib/logger";
import launch from "../route/launch";
import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletTransaction} from "./IWalletAdapter";
import {Game} from "../db/model/Game";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {getAvailableBets} from "../util/external";
import {errorCodes} from "./walletAdapter";

interface IConfig {
    includeProviderInGame?: boolean;
    url: string;
    secretKey: string;
    publicKey: string;
    timeout?: number;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const failedTransactionErrorCodes: string[] = [
    "ERROR_BAD_REQUEST",
    "ERROR_BAD_REQUEST_PLAYER_BLOCKED",
    "ERROR_INVALID_PUBLIC_KEY",
    "ERROR_INVALID_SIGNATURE",
    "ERROR_INVALID_SESSION",
    "ERROR_SESSION_EXPIRED",
    "ERROR_TIMEOUT",
    "ERROR_TRANSACTION_DUPLICATE",
    "ERROR_TRANSACTION_WITHDRAW_NOT_FOUND",
    "ERROR_ROLLBACK_TRANSACTION_NOT_FOUND",
];

export class FizzyBubblyWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;

    private cipher?: Cipher;

    private validateServer(req: Request, res: Response, next: NextFunction) {
        const path = `https://${req.get("host")}${req.originalUrl}`;

        const checksum = this.generateSignature(req.method as HttpMethod, path, this.modifyBody(req.body));
        if (req.headers["signature"] === checksum && req.headers["public-key"]) {
            return next();
        }
        res.status(403).json(this.sendError("ERROR_INVALID_SIGNATURE", "Couldn't authorize the server"));
    }

    private sendError(code: any, message: any) {
        return {
            code,
            message,
        };
    }

    async init(wallet: string, router: Router, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        // wallet/fizzybubbly/game/url
        router.post(
            "/game/url",
            this.validateServer.bind(this),
            validate([
                check("mode").isIn(["demo", "wallet"]),
                check("brandId").exists().notEmpty().isString().isLength({max: 255}),
                check("country").exists().notEmpty().isString().isLength({max: 255}),
                check("currency").exists().notEmpty().isString().isLength({max: 255}).toLowerCase(),
                check("gameId").exists().notEmpty().isString().isLength({max: 255}),
                check("locale").exists().notEmpty().isString().isLength({max: 10}).toLowerCase(),
                check("lobbyUrl").optional().notEmpty().isString().isLength({max: 1024}),
                check("platform").isIn(["web", "mobile"]),
                // Real
                check("sessionId").if(check("mode").equals("wallet")).exists().notEmpty().isString().isLength({max: 255}),
                check("playerId").if(check("mode").equals("wallet")).exists().notEmpty().isString().isLength({max: 255}),
                // Ignored for now
                // check("defaultBet").optional().notEmpty().isString().isLength({ max: 10 }),
                // check("maxBet").optional().notEmpty().isString().isLength({ max: 10 }),
                // check("minBet").optional().notEmpty().isString().isLength({ max: 10 }),
                // check("ip").optional().notEmpty().isString().isLength({ max: 50 }),
            ]),
            async (req: Request, res: Response) => {
                const mode = req.body.mode === "demo" ? "fun" : "real";
                const operator = req.body.brandId;
                const country = req.body.country?.toLowerCase();
                const currency = req.body.currency?.toLowerCase();
                const game = Game.removeProviderPrefix(config, req.body.gameId);
                const language = req.body.locale;
                const lobbyUrl = req.body.lobbyUrl || "";
                const device = req.body.platform;
                const playerId = req.body.playerId;
                const nativeId = playerId;
                const realMode = mode === "real";
                const key = this.cipher!.encrypt(
                    JSON.stringify({
                        nativeId,
                        currency,
                        language,
                        country,
                        device,
                        timestamp: Date.now(),
                        token: req.body.sessionId || "",
                    }),
                );

                try {
                    // do not send a "key" for fun mode
                    const url: string = await launch(mode, {wallet: this.wallet, operator, lobbyUrl, language, game, key: realMode ? key : ""}, req);
                    res.status(200).json({url});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("ERROR_BAD_REQUEST", e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/fizzybubbly/game/replay
        router.post(
            "/game/replay",
            this.validateServer.bind(this),
            validate([check("brandId").exists().notEmpty().isString().isLength({max: 255}), check("gameRoundId").isString().exists().isLength({max: 255}), check("gameId").exists().notEmpty().isString().isLength({max: 255})]),
            async (req, res) => {
                const operator = req.body.brandId;
                const roundId = req.body.gameRoundId;
                const game = Game.removeProviderPrefix(config, req.body.gameId);

                try {
                    const url: string = await launch("replay", {wallet: this.wallet, operator, game, roundId}, req);
                    res.status(200).json({url});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("ERROR_BAD_REQUEST", e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/fizzybubbly/free-spins-campaign/bet-values
        router.post(
            "/free-spins-campaign/bet-values",
            this.validateServer.bind(this),
            validate([
                check("brandId").exists().notEmpty().isString().isLength({max: 255}),
                check("gameId").exists().notEmpty().isString().isLength({max: 255}),
                check("currency").exists().notEmpty().isString().isLength({max: 255}).toLowerCase(),
            ]),
            async (req, res) => {
                const operator = req.body.brandId;
                const game = Game.removeProviderPrefix(config, req.body.gameId);
                const {provider} = await Game.get(game);
                const currency = req.body.currency?.toLowerCase();

                try {
                    const betValues = await getAvailableBets({wallet: this.wallet, operator, provider, game, currency});
                    res.status(200).json({betValues});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("ERROR_BAD_REQUEST", e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/fizzybubbly/free-spins-campaign/create
        router.post(
            "/free-spins-campaign/create",
            this.validateServer.bind(this),
            validate([
                check("betCount").exists().notEmpty().isInt(),
                check("betValue").exists().notEmpty().toFloat(),
                check("brandId").exists().notEmpty().isString().isLength({max: 255}),
                check("campaignId").exists().notEmpty().isString().isLength({max: 1024}),
                check("campaignName").exists().notEmpty().isString().isLength({max: 1024}),
                check("handoverAfter").exists().notEmpty().isInt().isLength({max: 255}), // start date
                check("consumeBefore").exists().notEmpty().isInt().isLength({max: 255}), //end date
                check("currency").exists().notEmpty().isString().isLength({max: 10}).toLowerCase(),
                check("gameIds").exists().notEmpty().isArray(),
                check("playerId").exists().notEmpty().isString().isLength({max: 1024}),
                // check("handoverBefore").optional().isInt().isLength({ max: 255 }), // ignore
            ]),
            async (req, res) => {
                const wallets = [this.wallet];
                const {betCount, betValue: amount, brandId, campaignId, campaignName, handoverAfter: start, consumeBefore: end, currency, gameIds, playerId: nativeId} = req.body;
                const operators = brandId ? [brandId] : [wallets];
                const nativeIds = [nativeId];

                if (gameIds.length > 1) {
                    res.status(400).json(this.sendError("ERROR_BAD_REQUEST", `Can't create campaign for multiple games`));
                    return;
                }

                const game = Game.removeProviderPrefix(config, gameIds[0]);
                const {provider} = await Game.get(game);

                const bets = parseInt(betCount, 10);
                // Get bet levels for the game in question to check if bet level supported
                const betLevels = await getAvailableBets({wallet: this.wallet, operator: operators[0], provider, game, currency: process.env.BASE_CURRENCY!});

                if (!betLevels.includes(amount)) {
                    res.status(400).json(this.sendError("ERROR_BAD_REQUEST", `Bet level of "${amount}" is not supported by "${game}" game.`));
                    return;
                }

                const name = `${campaignId}_${campaignName}`;
                const variables = {
                    data: {
                        type: "freeBets",
                        name,
                        start,
                        end,
                        wallets,
                        providers: [provider],
                        games: [game],
                        operators,
                        nativeIds,
                        config: {bets, currency, amount},
                    },
                };

                try {
                    if (await this.getCampaignByName(name)) {
                        throw new Exception(`Campaign named "${name}" already exists`);
                    }
                    const query = gql`
                        mutation ($data: CampaignInput!) {
                            addCampaign(data: $data)
                        }
                    `;
                    const response = await fetch(getServiceUrl("promo") + "/graphql", {
                        headers: {"Content-Type": "application/json"},
                        method: "POST",
                        body: JSON.stringify({query, variables, account: {}}),
                    });

                    const r = await response.json();
                    if (r.errors) {
                        res.status(400).json(this.sendError("ERROR_BAD_REQUEST", r.errors));
                        return;
                    }
                    const providerCampaignId = r.data.addCampaign;
                    res.status(200).json({providerCampaignId});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("ERROR_BAD_REQUEST", e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/fizzybubbly/free-spins-campaign/cancel
        router.post(
            "/free-spins-campaign/cancel",
            this.validateServer.bind(this),
            validate([check("providerCampaignId").exists().notEmpty().isString().isLength({max: 1024}), check("campaignId").exists().notEmpty().isString().isLength({max: 1024})]),
            async (req, res) => {
                const {providerCampaignId} = req.body;

                try {
                    const campaign = await this.getCampaignById(providerCampaignId);
                    if (!campaign) throw new Exception(`Couldn't find campaign id ${providerCampaignId}`);

                    const variables = {campaignId: campaign!.campaignId, data: {enabled: false}};
                    const query = gql`
                        mutation ($campaignId: ID!, $data: CampaignInput!) {
                            editCampaign(campaignId: $campaignId, data: $data)
                        }
                    `;
                    const response = await fetch(getServiceUrl("promo") + "/graphql", {
                        headers: {"Content-Type": "application/json"},
                        method: "POST",
                        body: JSON.stringify({query, variables, account: {}}),
                    });

                    const r = await response.json();
                    if (r.errors) {
                        throw new Exception("Error disabling free bets campaign");
                    }

                    res.status(200).json({});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("ERROR_BAD_REQUEST", e.message));
                        return;
                    }
                    throw e;
                }
            },
        );
    }

    private async getCampaignByName(name: string): Promise<string | undefined> {
        const variables = {name};

        try {
            const query = gql`
                query ($name: JSON!) {
                    campaigns(filter: {type: EQUAL, field: "name", value: $name}) {
                        items {
                            campaignId
                        }
                    }
                }
            `;
            const response = await fetch(getServiceUrl("promo") + "/graphql", {
                headers: {"Content-Type": "application/json"},
                method: "POST",
                body: JSON.stringify({query, variables, account: {}}),
            });

            const r = await response.json();
            return r.data?.campaigns && r.data?.campaigns.items[0].campaignId;
        } catch {
            return undefined;
        }
    }

    private async getCampaignById(campaignId: string): Promise<{campaignId: string; name: string} | undefined> {
        const variables = {campaignId};

        try {
            const query = gql`
                query ($campaignId: JSON!) {
                    campaigns(filter: {type: EQUAL, field: "campaignId", value: $campaignId}) {
                        items {
                            campaignId
                            name
                        }
                    }
                }
            `;
            const response = await fetch(getServiceUrl("promo") + "/graphql", {
                headers: {"Content-Type": "application/json"},
                method: "POST",
                body: JSON.stringify({query, variables, account: {}}),
            });

            const r = await response.json();
            return r.data?.campaigns && r.data?.campaigns.items[0];
        } catch {
            return undefined;
        }
    }

    private async isCampaignFinished(campaignId: string): Promise<{finished: boolean; totalWin: number}> {
        const variables = {campaignId};

        try {
            const query = gql`
                query ($campaignId: JSON!) {
                    campaignPlayers(filter: {type: EQUAL, field: "campaignId", value: $campaignId}) {
                        items {
                            finished
                            state
                        }
                    }
                }
            `;
            const response = await fetch(getServiceUrl("promo") + "/graphql", {
                headers: {"Content-Type": "application/json"},
                method: "POST",
                body: JSON.stringify({query, variables, account: {}}),
            });

            const r = await response.json();
            if (r.data?.campaignPlayers) {
                return {finished: r.data?.campaignPlayers.items[0].finished, totalWin: r.data?.campaignPlayers.items[0].state.totalWin};
            }
            return {finished: false, totalWin: 0};
        } catch {
            return {finished: false, totalWin: 0};
        }
    }

    private modifyBody(body: any): string {
        if (!body.betValue) return JSON.stringify(body);
        // "betValue" format – #.##, 2 digits after the decimal point
        const stringifiedData = JSON.stringify({...body, ...{betValue: body.betValue.toFixed(2)}});
        // Removes double quotes around the numeric value associated with the "betValue" key in the data string
        return stringifiedData.replace(/(?<="betValue":)"(\d+\.\d+)"/g, "$1");
    }

    private generateSignature(method: HttpMethod, path: string, body: string): string {
        const md5 = crypto.createHash("md5").update(body).digest("hex").toUpperCase();
        const toSign = `${method}\n${path}\n${md5}`;
        return crypto.createHmac("sha256", this.config.secretKey).update(toSign).digest("hex");
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

    private async getBalance(
        currency: string,
        playerId: string,
        sessionId: string,
    ): Promise<{
        balance: any;
        currency: any;
    }> {
        const params = {currency, playerId, sessionId};
        const data = await this.fetch("/wallet/balance", "POST", params);
        const {balance, currency: incomingCurrency} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId: playerId, wallet: this.wallet}});

        return {balance, currency: incomingCurrency};
    }

    private async fetch(path: string, method: HttpMethod, params: any): Promise<any> {
        const body = JSON.stringify(params);
        const headers: Record<string, string> = {};
        const url = `${this.config.url}${path}`;

        // Set headers
        headers["Content-Type"] = "application/json";
        headers["Public-Key"] = this.config.publicKey;
        headers["Signature"] = this.generateSignature(method, url, body);

        let json;
        let text;

        try {
            const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
            text = await response.text();
            json = JSON.parse(text);
        } catch (e) {
            throw new Exception("Couldn't fetch from wallet", {
                data: {wallet: this.wallet, error: e, request: {url, params}, response: text},
            });
        } finally {
            logger.info(`Wallet outgoing call (${this.wallet}): ${path}`, {req: params, res: json || text});
        }

        if (json.code) {
            if (json.code === "ERROR_TRANSACTION_INSUFFICIENT_FUNDS") {
                throw new Exception(json.message, {code: errorCodes.INSUFFICIENT_FUNDS});
            } else if (json.code === "ERROR_TRANSACTION_LIMIT_EXCEEDED") {
                throw new Exception(json.message, {code: errorCodes.LOSS_LIMIT});
            } else if (failedTransactionErrorCodes.includes(json.code)) {
                throw new Exception(json.message, {code: errorCodes.TRANSACTION_FAILED});
            }
            throw new Exception("Wallet returned error", {
                data: {wallet: this.wallet, error: json.message, request: {url, params}, response: text},
                code: errorCodes.UNKNOWN,
            });
        }
        return json;
    }

    async authenticate(key: string, operator: string, provider: string, game: string) {
        const {nativeId, currency, country, token} = this.getCipherData(key);
        const data = await this.getBalance(currency, nativeId, token);
        const {balance, currency: incomingCurrency} = data;

        if (!currency || !incomingCurrency) throw new Exception("Incorrect currency returned", {data: {data, currency: currency || incomingCurrency, key, wallet: this.wallet, operator, game}});

        return {nativeId: nativeId.toString(), token: token || key, country, balance, currency: currency.toLowerCase()};
    }

    async balance(player: Player, provider: string, game: string, {token}: ISession) {
        const {nativeId, currency} = player;
        return await this.getBalance(currency, nativeId, token);
    }

    async transaction(player: Player, transaction: IWalletTransaction, {token}: ISession) {
        const {nativeId, currency} = player;
        const {transactionId: transactionId, roundId: gameRoundId, amount, provider, game, roundFinished: isGameRoundFinished, type, name, campaignType, campaignId} = transaction;

        const isWithdraw = type === "withdraw";
        const isFreeBets = campaignType === "freeBets";

        const isFeatureBuy = name !== "main";

        const {finished: isFreeSpinsConsumed} = await this.isCampaignFinished(transaction.campaignId!);

        let freeSpinsCampaignId;
        if (isFreeBets && campaignId) {
            const campaign = await this.getCampaignById(campaignId!);
            freeSpinsCampaignId = campaign!.name.split("_")[0];
        }

        const params = {
            amount,
            currency: currency.toUpperCase(),
            gameId: Game.addProviderPrefix(this.config, provider!, game!),
            gameRoundId,
            isGameRoundFinished,
            playerId: nativeId,
            sessionId: token,
            transactionId,

            // Optional
            ...(isFreeBets && {freeSpinsCampaignId}), //
            ...(isFeatureBuy && isWithdraw && {isFeatureBuy}),
            ...(isFreeSpinsConsumed && {isFreeSpinsConsumed}), //
        };

        const path = isWithdraw ? "/wallet/withdraw" : "/wallet/deposit";
        const data = await this.fetch(path, "POST", params);

        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

        return {balance};
    }

    async cancel(player: Player, transaction: IWalletTransaction, {token}: ISession) {
        const {transactionId: transactionId, roundId: gameRoundId, provider, game} = transaction;
        const {nativeId} = player;

        const params = {
            gameId: Game.addProviderPrefix(this.config, provider!, game!),
            gameRoundId,
            playerId: nativeId,
            sessionId: token,
            transactionId,
            withdrawTransactionId: `rb_${transactionId}`,
        };

        const data = await this.fetch(`/wallet/rollback`, "POST", params);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

        return {balance};
    }
}

export default FizzyBubblyWalletAdapter;
