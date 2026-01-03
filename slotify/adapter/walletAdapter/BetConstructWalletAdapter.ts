/**
 * BetConstruct wallet adapter
 */
import {Express, NextFunction, Request, Response} from "express";
import {check, query} from "express-validator";
import {gql} from "graphql-request";
import * as crypto from "crypto";
import {DateTime} from "../util/luxon";
import Exception from "@slotify/shared/lib/Exception";
import {validate} from "@slotify/shared/lib/middleware/validate";
import Cipher from "@slotify/shared/lib/Cipher";
import fetch from "@slotify/shared/lib/fetch";
import logger from "@slotify/shared/lib/logger";
import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletTransaction} from "./IWalletAdapter";
import launch from "../route/launch";
import {Game} from "../db/model/Game";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {getAvailableBets} from "../util/external";
import {errorCodes} from "./walletAdapter";

interface IConfig {
    includeProviderInGame?: boolean;
    url: string;
    secretKey: string;
    timeout?: number;
}

const failedTransactionErrorCodes: string[] = ["4", "7", "8", "29", "34", "63", "84", "104", "105", "106", "107", "114", "130"];
const dateFormat = "dd-MM-yyyy HH:mm:ss";

export class BetConstructWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;

    private cipher?: Cipher;

    private validateServer(req: Request, res: Response, next: NextFunction) {
        const {time, hash, data} = req.body;
        // "automaticForfeitValue" format – #.####, four digits after the decimal point
        const stringifiedData = JSON.stringify({...data, ...{automaticForfeitValue: data.automaticForfeitValue.toFixed(4)}});
        // Removes double quotes around the numeric value associated with the "automaticForfeitValue" key in the data string
        const modifiedData = stringifiedData.replace(/(?<="automaticForfeitValue":)"(\d+\.\d+)"/g, "$1");
        const checksum = this.getHash(time, modifiedData);

        if (hash === checksum) {
            return next();
        }

        res.status(403).json({err_code: 403, err_desc: "Couldn't authorize the server"});
    }

    private validateGetRequest(req: Request, res: Response, next: NextFunction) {
        const checksum = crypto.createHmac("sha256", this.config.secretKey).update(JSON.stringify(req.query)).digest("hex");
        if (req.headers["x-request-sign"] === checksum) {
            return next();
        }

        res.status(403).json({err_code: 403, err_desc: "Couldn't authorize the request"});
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        // wallet/betconstruct/launch
        api.get(
            path + "/launch",
            this.validateGetRequest.bind(this),
            validate([
                query("mode").isIn(["demo", "real_play"]),
                query("operatorId").exists().notEmpty().isString().isLength({max: 255}),
                query("gameId").exists().notEmpty().isString().isLength({max: 255}),
                query("language").exists().notEmpty().isString().isLength({max: 10}).toLowerCase(),
                query("device").isIn(["1", "2"]),
                query("homeUrl")
                    .optional()
                    .notEmpty()
                    .isString()
                    .customSanitizer(value => (value ? value : ""))
                    .isLength({max: 1024}),
                query("playerId").if(query("mode").equals("real_play")).notEmpty().isString().isLength({max: 255}),
                query("currency").if(query("mode").equals("real_play")).notEmpty().isString().isLength({max: 255}).toLowerCase(),
                query("currency").default(process.env.BASE_CURRENCY).toLowerCase(),
                query("token").if(query("mode").equals("real_play")).notEmpty().isString().isLength({max: 255}),
                query("token").customSanitizer(value => value || ""),
                query("jurisdiction")
                    .optional()
                    .notEmpty()
                    .isString()
                    .customSanitizer(value => (value ? value : ""))
                    .isLength({max: 255})
                    .toLowerCase(),
            ]),
            async (req: Request, res: Response) => {
                const mode = req.query.mode === "demo" ? "fun" : "real";
                const operator = req.query.operatorId as string;
                const game = Game.removeProviderPrefix(config, req.query.gameId as string);
                const language = req.query.language as string;
                const device = req.query.device === "1" ? "desktop" : "mobile";
                const lobbyUrl = req.query.homeUrl as string;
                const playerId = req.query.playerId as string;
                const nativeId = playerId;
                const currency = req.query.currency as string;
                const jurisdiction = req.query.jurisdiction as string;
                const country = jurisdiction;
                const realMode = mode === "real";
                const key = this.cipher!.encrypt(
                    JSON.stringify({
                        nativeId,
                        currency,
                        jurisdiction,
                        language,
                        country,
                        device,
                        timestamp: Date.now(),
                        token: req.query.token || "",
                    }),
                );

                try {
                    // do not send a "key" for fun mode
                    const url: string = await launch(mode, {wallet: this.wallet, operator, lobbyUrl, language, game, key: realMode ? key : ""}, req);
                    res.json({url});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json({err_code: e.code, err_desc: e.message});
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/betconstruct/launch/replay
        api.get(
            path + "/launch/replay",
            this.validateGetRequest.bind(this),
            validate([query("operatorId").isString().exists().isLength({max: 255}), query("gameId").isString().exists().isLength({max: 255}), query("roundId").isString().exists().isLength({max: 255})]),
            async (req, res) => {
                const operator = req.query.operatorId as string;
                const roundId = req.query.roundId as string;
                const game = Game.removeProviderPrefix(config, req.query.gameId as string);

                try {
                    const url: string = await launch("replay", {wallet: this.wallet, operator, game, roundId}, req);
                    res.json({url});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json({err_code: e.code, err_desc: e.message});
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/betconstruct/freespins
        api.post(
            path + "/freespins",
            this.validateServer.bind(this),
            validate([
                check("time").exists().notEmpty().isString().isLength({max: 255}),
                check("data.playerId").exists().notEmpty().isString().isLength({max: 255}),
                check("data.currency").exists().notEmpty().isString().isLength({max: 255}).toLowerCase(),
                check("data.externalReferenceId").exists().notEmpty().isString().isLength({max: 255}),
                check("data.gameIds").exists().notEmpty().isArray(),
                check("data.numberOfFreeRounds").exists().notEmpty().isString().isLength({max: 255}),
                check("data.freeRoundValidity").exists().notEmpty().isString().isLength({max: 255}),
                check("data.operatorCode").optional().isLength({max: 255}),
                check("hash").exists().notEmpty().isString().isLength({max: 255}),
            ]),
            async (req, res) => {
                const wallets = [this.wallet];
                const {playerId: nativeId, currency, externalReferenceId, gameIds, numberOfFreeRounds, freeRoundValidity, operatorCode} = req.body.data;
                const operators = operatorCode ? [operatorCode] : [wallets];

                const nativeIds = [nativeId];

                const name = `betconstruct-api_${externalReferenceId}`;

                if (gameIds.length > 1) {
                    throw new Exception("Can't create campaign for multiple games");
                }

                const game = Game.removeProviderPrefix(config, gameIds[0]);
                const {provider} = await Game.get(game);

                const end = DateTime.fromFormat(freeRoundValidity, dateFormat).toMillis();

                // We are given a number of free spins. Free Spins are always played with a minimal bet specified for each game. We need to:
                const bets = parseInt(numberOfFreeRounds, 10);
                // 1. Get bet levels for the game in question
                const betLevels = await getAvailableBets({wallet: this.wallet, operator: operators[0], provider, game, currency});
                // 2.  Get the min bet level
                const amount = betLevels[0];

                const variables = {
                    data: {type: "freeBets", name, end, wallets, providers: [provider], games: [game], operators, nativeIds, config: {bets, currency, amount}},
                };

                try {
                    if (await this.getCampaignByName(name)) {
                        throw new Exception(`Campaign named ${name} already exists`);
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
                        res.status(400).json({result: false, err_code: 400, err_desc: r.errors});
                        return;
                    }
                    const referenceId = r.data.addCampaign;
                    res.status(201).json({result: true, referenceId});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json({result: false, err_code: 400, err_desc: e.message});
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

    private async getCampaignNameById(campaignId: string): Promise<string | undefined> {
        const variables = {campaignId};

        try {
            const query = gql`
                query ($campaignId: JSON!) {
                    campaigns(filter: {type: EQUAL, field: "campaignId", value: $campaignId}) {
                        items {
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
            return r.data?.campaigns && r.data?.campaigns.items[0].name;
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

    private getHash(time: string, data: string) {
        const concatenatedString = this.config.secretKey + time + data;
        return crypto.createHash("md5").update(concatenatedString).digest("hex");
    }

    // Replaces the double-quoted numeric values associated with the "winAmount" and "betAmount" keys with just the numeric values, effectively removing the double quotes.
    private modifyData(data: any) {
        return data.replace(/(?<="winAmount":)"(\d+\.\d+)"|(?<="betAmount":)"(\d+\.\d+)"/g, "$1$2");
    }

    private hashData(data: any) {
        const time = DateTime.local().toFormat(dateFormat);
        const modifiedData = this.modifyData(JSON.stringify(data));
        const hash = this.getHash(time, modifiedData);
        return {time, data, hash};
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

    private async fetch(path: string, method: string, params: any): Promise<any> {
        const {time, data, hash} = this.hashData(params);
        const body = params ? this.modifyData(JSON.stringify({time, data, hash})) : undefined;
        const headers: Record<string, string> = {};

        headers["Content-Type"] = "application/json";

        let json;
        let text;
        const url = `${this.config.url}${path}`;

        try {
            const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 3) * 1000});
            text = await response.text();
            json = JSON.parse(text);
        } catch (e) {
            throw new Exception("Couldn't fetch from wallet", {data: {wallet: this.wallet, error: e, request: {url, data}, response: text}});
        } finally {
            logger.info(`Wallet outgoing call (${this.wallet}): ${path}`, {req: data, res: json || text});
        }

        if (json.err_code) {
            if (json.err_code === 21) {
                throw new Exception(json.err_desc, {code: errorCodes.INSUFFICIENT_FUNDS});
            } else if (json.err_code === 104) {
                return await this.fetch("/GetPlayerInfo", "POST", {token: params.token});
            } else if (json.err_code === 127) {
                throw new Exception(json.err_desc, {code: errorCodes.LOSS_LIMIT});
            } else if (json.err_code === 200) {
                throw new Exception(json.err_desc, {code: errorCodes.TRANSACTION_FAILED});
            } else if (failedTransactionErrorCodes.includes(json.err_code)) {
                throw new Exception(json.err_desc, {code: errorCodes.TRANSACTION_FAILED});
            }
            throw new Exception("Wallet returned error", {
                data: {wallet: this.wallet, error: json.err_desc, request: {url, params}, response: text},
                code: errorCodes.UNKNOWN,
            });
        }
        return json;
    }

    async authenticate(key: string, operator: string, provider: string, game: string) {
        const {currency, jurisdiction, country, token} = this.getCipherData(key);
        const data = await this.fetch("/GetPlayerInfo", "POST", {token});
        const {userID: nativeId, totalBalance: balance, currencyId: incomingCurrency} = data;

        if (!nativeId) throw new Exception("Incorrect nativeId returned", {data: {data, key, wallet: this.wallet, operator, game, nativeId}});
        if (!currency || !incomingCurrency) throw new Exception("Incorrect currency returned", {data: {data, currency: currency || incomingCurrency, key, wallet: this.wallet, operator, game}});
        if (incomingCurrency.toLowerCase() !== currency.toLowerCase())
            throw new Exception("Player currency does not match incoming currency", {
                data: {data, currency, incomingCurrency, key, wallet: this.wallet, operator, game},
            });
        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, key, wallet: this.wallet, operator, game}});

        return {nativeId: nativeId.toString(), token: token || key, country, balance, currency: currency.toLowerCase(), jurisdiction};
    }

    async balance(player: Player, provider: string, game: string, {token}: ISession) {
        const {nativeId} = player;

        const data = await this.fetch("/GetPlayerInfo", "POST", {token});
        const {totalBalance: balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});

        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession) {
        const {nativeId, currency} = player;
        const {token} = session;
        const {transactionId, roundId, amount, provider, game, type, campaignType, campaignId} = transaction;
        const isDeposit = type === "deposit";

        if (campaignType === "freeBets") {
            const {finished, totalWin} = await this.isCampaignFinished(campaignId!);
            if (finished) {
                const name = await this.getCampaignNameById(campaignId!);
                if (!name) throw new Exception("Couldn't find campaign name");

                const params = {
                    token,
                    transactionId,
                    roundId,
                    gameId: Game.addProviderPrefix(this.config, provider!, game!),
                    currencyId: currency.toUpperCase(),
                    winAmount: totalWin % 1 === 0 ? totalWin.toFixed(1) : totalWin,
                    betInfo: "",
                };

                const data = await this.fetch("/FSDeposit", "POST", params);
                const {balance} = data;
                if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});

                return {balance};
            } else {
                return this.balance(player, transaction.provider!, transaction.game!, session);
            }
        } else {
            const round_status = isDeposit ? 3 : 2; // 3 - closed, 2 - pending
            const bet = amount % 1 === 0 ? amount.toFixed(1) : amount;
            const params = {
                token,
                transactionId,
                roundId,
                gameId: Game.addProviderPrefix(this.config, provider!, game!),
                currencyId: currency.toUpperCase(),
                ...(isDeposit ? {winAmount: bet} : {betAmount: bet}),
                round_status,
                betInfo: "",
            };

            const url = transaction.type === "withdraw" ? "Withdraw" : "Deposit";
            const data = await this.fetch(`/${url}`, "POST", params);

            const {balance} = data;

            if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

            return {balance};
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction, {token}: ISession) {
        const {transactionId, game, provider} = transaction;
        const {nativeId} = player;

        const params = {
            token,
            transactionId,
            gameId: Game.addProviderPrefix(this.config, provider!, game!),
        };

        const data = await this.fetch(`/RollbackTransaction`, "POST", params);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

        return {balance};
    }
}

export default BetConstructWalletAdapter;
