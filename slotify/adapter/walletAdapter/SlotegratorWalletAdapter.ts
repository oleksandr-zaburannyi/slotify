/**
 * Slotegrator wallet adapter
 */
import {Express, NextFunction, Request, Response} from "express";
import {check} from "express-validator";
import * as crypto from "crypto";
import {gql} from "graphql-request";
import {DateTime} from "../util/luxon";
import Exception from "@slotify/shared/lib/Exception";
import {validate} from "@slotify/shared/lib/middleware/validate";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
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

const failedTransactionErrorCodes: string[] = [
    "BET_FAILED_KNOWN_ERROR",
    "INTERNAL_ERROR",
    "SESSION_NOT_FOUND",
    "TRANSACTION_PREPARING_ERROR",
    "TRANSACTION_DENIED",
    "INVALID_SIGN",
    "AMOUNT_SHOULD_BE_POSITIVE",
    "ACTION_IS_NOT_EXIST",
    "WRONG_INPUT_PARAMETERS",
    "TRANSACTION_IN_PROGRESS",
];

export class SlotegratorWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    campaignPrefix!: string;

    private cipher?: Cipher;

    private validateServer(req: Request, res: Response, next: NextFunction) {
        const checksum = this.getHash((req as any).rawBody);

        if (req.headers["x-sign"] === checksum) {
            return next();
        }
        res.status(403).json(this.sendError(403, "Couldn't authorize the server"));
    }

    private sendError(code: any, message: any) {
        return {
            status: false,
            code,
            message,
        };
    }

    // Middleware to set the 'mode' property in the request body based on the presence of 'session_id' or 'player_id'.
    private checkMode(req: Request, res: Response, next: NextFunction) {
        const {session_id, player_id} = req.body;
        req.body.mode = session_id || player_id ? "real" : "fun";
        return next();
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
        this.campaignPrefix = "slotegrator-api";
        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        // wallet/slotegrator/launch
        api.post(
            path + "/launch",
            this.validateServer.bind(this),
            this.checkMode.bind(this),
            validate([
                check("client_id").exists().notEmpty().isString().isLength({max: 255}),
                check("game_id").exists().notEmpty().isString().isLength({max: 255}),
                check("language").exists().notEmpty().isString().isLength({max: 10}).toLowerCase(),
                check("return_url").optional().notEmpty().isString().isLength({max: 1024}),
                // Real
                check("session_id").if(check("mode").equals("real")).exists().notEmpty().isString().isLength({max: 255}),
                check("player_id").if(check("mode").equals("real")).exists().notEmpty().isString().isLength({max: 255}),
                check("currency").if(check("mode").equals("real")).exists().notEmpty().isString().isLength({max: 255}).toLowerCase(),
            ]),
            async (req: Request, res: Response) => {
                const mode = req.body.mode;
                const operator = req.body.client_id;
                const game = Game.removeProviderPrefix(config, req.body.game_id);
                const language = req.body.language;
                const lobbyUrl = req.body.return_url || "";
                const playerId = req.body.player_id;
                const nativeId = playerId;
                const currency = req.body.currency?.toLowerCase();
                const device = req.body.device;
                const country = req.body.country?.toLowerCase();
                const realMode = mode === "real";
                const key = this.cipher!.encrypt(
                    JSON.stringify({
                        nativeId,
                        currency,
                        language,
                        country,
                        device,
                        timestamp: Date.now(),
                        token: req.body.session_id || "",
                    }),
                );

                try {
                    // do not send a "key" for fun mode
                    const url: string = await launch(mode, {wallet: this.wallet, operator, lobbyUrl, language, game, key: realMode ? key : ""}, req);
                    res.status(200).json({url});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("WRONG_INPUT_PARAMETERS", e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/slotegrator/addFreeRounds
        api.post(
            path + "/addFreeRounds",
            this.validateServer.bind(this),
            validate([
                check("client_id").exists().notEmpty().isString().isLength({max: 255}),
                check("game_id").exists().notEmpty().isString().isLength({max: 255}),
                check("player_id").exists().notEmpty().isString().isLength({max: 1024}),
                check("currency").exists().notEmpty().isString().isLength({max: 10}).toLowerCase(),
                check("campaign_id").exists().notEmpty().isString().isLength({max: 1024}),
                check("quantity").exists().notEmpty().isInt(),
                check("valid_from").optional().isInt().isLength({max: 255}),
                check("valid_until").optional().isInt().isLength({max: 255}),
                check("bet_id").exists().notEmpty().isInt(),
            ]),
            async (req, res) => {
                const wallets = [this.wallet];
                const {player_id: nativeId, currency, campaign_id, game_id, quantity, valid_from, valid_until, client_id, bet_id} = req.body;
                const operators = client_id ? [client_id] : [wallets];

                const nativeIds = [nativeId];

                const name = `${this.campaignPrefix}_${campaign_id}`;

                const game = Game.removeProviderPrefix(config, game_id);
                const {provider} = await Game.get(game);

                const start = DateTime.fromSeconds(valid_from).toMillis();
                const end = DateTime.fromSeconds(valid_until).toMillis();

                // We are given a number of free spins. Free Spins are always played with a minimal bet specified for each game. We need to:
                const bets = parseInt(quantity, 10);
                // 1. Get bet levels for the game in question
                const betLevels = await getAvailableBets({wallet: this.wallet, operator: operators[0], provider, game, currency});
                // 2.  Get the min bet level
                const amount = betLevels[bet_id];

                if (!amount) {
                    res.status(400).json(this.sendError("WRONG_INPUT_PARAMETERS", `Bet level for bet_id ${bet_id} not supported`));
                    return;
                }

                const variables = {
                    data: {
                        type: "freeBets",
                        name,
                        ...(start && {start}),
                        ...(end && {end}),
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
                        res.status(400).json(this.sendError("WRONG_INPUT_PARAMETERS", r.errors));
                        return;
                    }
                    const new_campaign_id = r.data.addCampaign;
                    res.status(201).json({status: true, new_campaign_id});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("WRONG_INPUT_PARAMETERS", e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/slotegrator/removeFreeRounds
        api.post(
            path + "/removeFreeRounds",
            this.validateServer.bind(this),
            validate([check("client_id").exists().notEmpty().isString().isLength({max: 255}), check("campaign_id").exists().notEmpty().isString().isLength({max: 1024})]),
            async (req, res) => {
                const {campaign_id} = req.body;

                try {
                    const campaignId = await this.getCampaignByName(`${this.campaignPrefix}_${campaign_id}`);
                    if (!campaignId) throw new Exception(`Couldn't find campaign id ${campaign_id}`);

                    const variables = {campaignId, data: {enabled: false}};
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

                    res.status(200).json({status: true});
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError("WRONG_INPUT_PARAMETERS", e.message));
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

    private getHash(data: any) {
        return crypto.createHmac("sha256", this.config.secretKey).update(data).digest("hex");
    }

    private hashData(payload: any) {
        const requestJson = JSON.stringify(payload);
        const hash = this.getHash(requestJson);
        return hash;
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
        token: string,
        nativeId: string,
    ): Promise<{
        balance: any;
    }> {
        const params = {action: "balance", session_id: token};
        const data = await this.fetch("/", "POST", params, this.hashData(params));
        if (typeof data?.balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, nativeId}});
        return data;
    }

    private async fetch(path: string, method: string, params: any, hash?: string): Promise<any> {
        const body = params ? JSON.stringify(params) : undefined;
        const headers: Record<string, string> = {};

        headers["Content-Type"] = "application/json";
        if (hash) headers["X-SIGN"] = hash;

        let json;
        let text;
        const url = `${this.config.url}${path}`;

        let retry = 1;
        do {
            try {
                const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 5) * 1000});
                text = await response.text();
                json = JSON.parse(text);
            } catch (e) {
                if (retry === 0) {
                    throw new Exception("Couldn't fetch from wallet", {
                        data: {wallet: this.wallet, error: e, request: {url, params}, response: text},
                    });
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${path}`, {req: params, res: json || text});
            }

            if (json?.code) {
                if (json.code === "INSUFFICIENT_BALANCE") {
                    throw new Exception(json.message, {code: errorCodes.INSUFFICIENT_FUNDS});
                } else if (json.code === "BET_FAILED_UNKNOWN_ERROR") {
                    throw new Exception(json.message, {code: errorCodes.UNKNOWN});
                } else if (failedTransactionErrorCodes.includes(json.code)) {
                    throw new Exception(json.message, {code: errorCodes.TRANSACTION_FAILED});
                }
                if (retry === 0) {
                    throw new Exception("Wallet returned error", {
                        data: {wallet: this.wallet, error: json.message, request: {url, params}, response: text},
                        code: errorCodes.UNKNOWN,
                    });
                }
            }
        } while (--retry >= 0 && !json);
        return json;
    }

    async authenticate(key: string) {
        const {nativeId, country, currency, token} = this.getCipherData(key);
        const {balance} = await this.getBalance(token, nativeId);

        return {nativeId: nativeId.toString(), token: token || key, country, balance, currency: currency.toLowerCase()};
    }

    async balance(player: Player, provider: string, game: string, {token}: ISession) {
        const {nativeId} = player;
        const {balance} = await this.getBalance(token, nativeId);

        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, {token}: ISession) {
        const {nativeId, currency} = player;
        const {transactionId: transaction_id, roundId: round_id, amount, provider, game, roundFinished, type, campaignType} = transaction;

        const isWithdraw = type === "withdraw";
        const isFreeBets = campaignType === "freeBets";

        const params = {
            action: isWithdraw ? "bet" : "win",
            type: isFreeBets ? "freespin" : isWithdraw ? "bet" : "win",
            game_id: Game.addProviderPrefix(this.config, provider!, game!),
            is_finished: roundFinished,
            session_id: token,
            transaction_id,
            round_id,
            currency: currency.toUpperCase(),
            amount,
        };

        const data = await this.fetch("/", "POST", params, this.hashData(params));

        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

        return {balance};
    }

    async cancel(player: Player, transaction: IWalletTransaction, {token}: ISession) {
        const {transactionId: transaction_id, roundId: round_id, provider, game} = transaction;
        const {nativeId, currency} = player;

        const params = {
            action: "refund",
            session_id: token,
            transaction_id,
            round_id,
            game_id: Game.addProviderPrefix(this.config, provider!, game!),
            currency: currency.toUpperCase(),
            is_finished: true,
        };

        const data = await this.fetch(`/`, "POST", params, this.hashData(params));
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});

        return {balance};
    }
}

export default SlotegratorWalletAdapter;
