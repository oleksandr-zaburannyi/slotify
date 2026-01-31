/**
 * Reevo wallet adapter
 */
import {Express, Request, Response} from "express";
import {check, query} from "express-validator";
import * as crypto from "crypto";
import {gql} from "graphql-request";
import {DateTime} from "../util/luxon";
import Exception from "@slotify/shared/lib/Exception";
import {validate} from "@slotify/shared/lib/middleware/validate";
import logger from "@slotify/shared/lib/logger";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletTransaction} from "./IWalletAdapter";
import launch from "../route/launch";
import {Game} from "../db/model/Game";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {cancelCampaign, getAvailableBets, getCampaignByName} from "../util/external";
import {errorCodes} from "./walletAdapter";

interface IConfig {
    includeProviderInGame?: boolean;
    url: string;
    callerID: string;
    callerPass: string;
    salt: string;
    timeout?: number;
    operator?: string;
    hostname?: string;
}

type Method = "GET" | "POST";

interface SessionInfo {
    gamesession_id: string;
    session_id: string;
}

// const operator = "reevo";

export class ReevoWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;

    private cipher?: Cipher;

    // Reevo refused to implement authentication for our endpoints.
    // private validateServer(req: Request, res: Response, next: NextFunction) {
    //   const { key, ...propsToHash } = req.body;
    //   const checksum = this.getHash(propsToHash);

    //   if (key === checksum) return next();

    //   res.status(403).json(this.sendError("Couldn't authorize the server"));
    // }

    // Must be unique for each session. Regenerated on every game launch request.
    // It is sent in Real mode in "gamesession_id" and "sessionid" with each request and does not change throughout the session unless the game is reloaded.
    private getSessionHash(playerId: string, timestamp: number) {
        return crypto.createHmac("sha256", this.config.salt).update(JSON.stringify({playerId, timestamp})).digest("hex");
    }

    private sendError(message: any) {
        return {
            error: 1,
            message,
        };
    }
    private get operator() {
        return this.config.operator || "reevo";
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.callerPass, this.wallet);

        // wallet/reevo/launch
        api.post(
            path + "/launch",
            // this.validateServer.bind(this),
            validate([
                check("play_for_fun").isIn(["0", "1"]),
                check("operator").exists().notEmpty().isString().isLength({max: 255}),
                check("gameid").exists().notEmpty().isString().isLength({max: 255}),
                check("user_id").if(query("mode").equals("real_play")).notEmpty().isString().isLength({max: 255}),
                check("user_nickname").isString().optional().isLength({max: 255}),
                check("user_password").if(query("mode").equals("real_play")).notEmpty().isString().isLength({max: 255}),
                check("lang").exists().notEmpty().isString().isLength({max: 10}).toLowerCase(),
                check("currency").exists().notEmpty().isString().isLength({max: 255}).toLowerCase(),
                check("country").optional().notEmpty().isString().isLength({max: 255}).toLowerCase(),
                check("channel").optional().isIn(["mobile", "desktop"]),
                check("homeurl").optional().isString().isLength({max: 1024}),
            ]),
            async (req: Request, res: Response) => {
                const mode = req.body.play_for_fun === "1" ? "fun" : "real";
                const brand = req.body.operator;
                const game = Game.removeProviderPrefix(config, req.body.gameid);
                const language = req.body.lang;
                const device = req.body.channel;
                const lobbyUrl = req.body.homeUrl || "";
                const playerId = req.body.user_id;
                const nativeId = playerId;
                const nickname = req.body.user_nickname || "";
                const currency = req.body.currency?.toLowerCase();
                const country = req.body.country?.toLowerCase();
                const realMode = mode === "real";
                const timestamp = Date.now();
                const key =
                    mode === "fun"
                        ? `::${currency}:::${brand || ""}`
                        : this.cipher!.encrypt(
                              JSON.stringify({
                                  nativeId,
                                  currency,
                                  language,
                                  country,
                                  nickname,
                                  device,
                                  timestamp,
                                  brand,
                                  token: req.body.user_password || "",
                              }),
                          );

                try {
                    const url: string = await launch(
                        mode,
                        {
                            wallet: this.wallet,
                            operator: this.operator,
                            lobbyUrl,
                            language,
                            game,
                            theme: brand,
                            key,
                            hostname: config.hostname,
                        },
                        req,
                    );
                    const gamesession_id = realMode ? this.getSessionHash(playerId, timestamp) : null;
                    const result = {
                        error: 0,
                        response: url,
                        ...(realMode ? {gamesession_id, sessionid: gamesession_id} : {}),
                        currency: currency?.toUpperCase(),
                    };
                    res.json(result);
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError(e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/reevo/launch/replay
        api.post(
            path + "/launch/replay",
            // this.validateServer.bind(this),
            validate([check("operatorId").isString().exists().isLength({max: 255}), check("gameId").isString().exists().isLength({max: 255}), check("roundId").isString().exists().isLength({max: 255})]),
            async (req, res) => {
                // const brand = req.body.operatorId as string;
                const roundId = req.body.roundId as string;
                const game = Game.removeProviderPrefix(config, req.body.gameId);

                try {
                    const url: string = await launch(
                        "replay",
                        {
                            wallet: this.wallet,
                            operator: this.operator,
                            game,
                            roundId,
                            hostname: config.hostname,
                        },
                        req,
                    );
                    const response = {
                        error: 0,
                        url,
                    };
                    res.json(response);
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError(e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/reevo/addFreeRounds
        api.post(
            path + "/addFreeRounds",
            // this.validateServer.bind(this),
            validate([
                check("api_login").equals(this.config.callerID),
                check("api_password").equals(this.config.callerPass),
                check("uid").exists().notEmpty().isString().isLength({max: 255}),
                check("playerids").exists().notEmpty().isString(),
                check("gameids").exists().notEmpty().isString(),
                check("available").exists().notEmpty().isInt(),
                check("betlevel").isIn(["min", "mid", "max"]),
                check("currency").exists().notEmpty().isString().isLength({max: 255}).toLowerCase(),
                check("operator").exists().notEmpty().isString().isLength({max: 255}),
                check("title").optional().isLength({max: 255}),
                check("validFrom").optional().isString().isLength({max: 255}),
                check("validTo").optional().isString().isLength({max: 255}),
            ]),
            async (req, res) => {
                const {playerids, currency, uid, gameids, available, betlevel, validFrom, validTo, operator: brand} = req.body;

                const nativeIds = playerids.split(",").map((value: string) => value.trim());
                const gamesWithProvider = gameids.split(",").map((value: string) => value.trim());

                const name = `reevo-api_${uid}`;

                if (gamesWithProvider.length > 1) {
                    throw new Exception("Can't create campaign for multiple games");
                }

                const game = Game.removeProviderPrefix(config, gamesWithProvider[0]);
                const {provider} = await Game.get(game);

                const start = DateTime.fromISO(validFrom).toMillis();
                const end = DateTime.fromISO(validTo).toMillis();

                const bets = parseInt(available, 10);
                // 1. Get bet levels for the game in question
                const betLevels = await getAvailableBets({
                    wallet: this.wallet,
                    operator: this.operator,
                    brand,
                    provider,
                    game,
                    currency,
                });
                // 2. Get the "min", "mid" or "max" bet level
                const amount = betlevel === "min" ? betLevels[0] : betlevel === "mid" ? betLevels[Math.floor(betLevels.length / 2)] : betLevels[betLevels.length - 1];

                const variables = {
                    data: {
                        type: "freeBets",
                        name,
                        start,
                        end,
                        wallet: [this.wallet],
                        providers: [provider],
                        games: [game],
                        operator: [this.operator],
                        brands: [brand],
                        nativeIds,
                        config: {bets, currency, amount},
                    },
                };

                try {
                    let code = 200;
                    let created = 0;
                    const campaign = await getCampaignByName(name);
                    let freeround_id = campaign?.campaignId;

                    if (!campaign) {
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
                            res.status(400).json(this.sendError(r.errors));
                            return;
                        }
                        freeround_id = r.data.addCampaign;
                        code = 201;
                        created = 1;
                    }

                    const result = {
                        error: 0,
                        response: {
                            created,
                            freeround_id,
                            currency: currency.toUpperCase(),
                        },
                    };
                    res.status(code).json(result);
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError(e.message));
                        return;
                    }
                    throw e;
                }
            },
        );

        // wallet/reevo/removeFreeRounds
        api.post(
            path + "/removeFreeRounds",
            // this.validateServer.bind(this),
            validate([
                check("api_login").equals(this.config.callerID),
                check("api_password").equals(this.config.callerPass),
                check("playerids").exists().notEmpty().isString(),
                check("freeround_id").exists().notEmpty().isString().isLength({max: 255}),
                check("currency").exists().notEmpty().isString().isLength({max: 255}).toLowerCase(),
                check("operator").exists().notEmpty().isString().isLength({max: 255}),
            ]),
            async (req, res) => {
                const campaignId = req.body.freeround_id;

                try {
                    await cancelCampaign(campaignId);

                    const result = {
                        error: 0,
                        message: "success",
                    };

                    res.status(200).json(result);
                } catch (e) {
                    if (e instanceof Exception) {
                        res.status(400).json(this.sendError(e.message));
                        return;
                    }
                    throw e;
                }
            },
        );
    }

    private formatBalance(data: any) {
        const {balance: balanceAsString} = data;
        return parseFloat(balanceAsString);
    }

    private getHash(data: any) {
        const queryString = new URLSearchParams(data).toString();
        const queryStringWithSalt = this.config.salt + queryString;
        return crypto.createHash("sha1").update(queryStringWithSalt).digest("hex");
    }

    private async getTimestampFromSession(session: ISession): Promise<number> {
        return session.data.timestamp;
    }

    private async addSessionParams(nativeId: string, timestamp: number) {
        const gamesession_id = this.getSessionHash(nativeId, timestamp);
        return {gamesession_id: gamesession_id, session_id: gamesession_id};
    }

    private getCipherData = (key: string) => {
        let decrypted;
        try {
            decrypted = JSON.parse(this.cipher!.decrypt(key));
        } catch {
            throw new Exception("Incorrect authentication key", {
                data: {key, wallet: this.wallet},
            });
        }
        return decrypted;
    };

    private async getBalance({nativeId, provider, game, nickname, sessionData}: {nativeId: string; provider: string; game: string; nickname?: string | undefined; sessionData: SessionInfo}): Promise<any> {
        const params = {
            action: "balance",
            remote_id: nativeId,
            username: nickname || nativeId,
            game_id_hash: Game.addProviderPrefix(this.config, provider!, game!),
            ...sessionData,
        };
        return await this.fetch("/", "GET", params);
    }

    private async fetch(path: string, method: Method, params: any): Promise<any> {
        const headers: Record<string, string> = {};
        const isGet = method === "GET";
        const callerData = {
            callerId: this.config.callerID,
            callerPassword: this.config.callerPass,
        };
        let body;
        let query;

        if (isGet && params) {
            const key = this.getHash({...params, ...callerData});
            query = new URLSearchParams({
                key,
                ...params,
                ...callerData,
            }).toString();
        } else {
            body = params ? JSON.stringify(params) : undefined;
        }

        headers["Content-Type"] = "application/json";

        let json;
        let text;
        const url = `${this.config.url}${path}${isGet ? `?${query}` : ""}`;

        try {
            const response = await fetch(url, {
                method,
                body,
                headers,
                timeout: (this.config.timeout || 15) * 1000,
            });
            text = await response.text();
            json = JSON.parse(text);
        } catch (e) {
            throw new Exception("Couldn't fetch from wallet", {
                data: {
                    wallet: this.wallet,
                    error: e,
                    request: {url, params},
                    response: text,
                },
            });
        } finally {
            logger.info(`Wallet outgoing call (${this.wallet}): ${path} - action: "${params.action}"`, {req: query || body, res: json || text});
        }

        if (json.status !== 200) {
            // Only an error response has "msg" property
            const msg = json.msg || "Wallet returned error";
            if (json.status === 403) {
                throw new Exception(msg, {code: errorCodes.INSUFFICIENT_FUNDS});
            } else if (json.status === 404) {
                throw new Exception(msg, {
                    code: errorCodes.TRANSACTION_NOT_FOUND,
                });
            } else if (json.status === 500) {
                throw new Exception(msg, {code: errorCodes.UNKNOWN});
            }
            throw new Exception(msg, {
                data: {
                    wallet: this.wallet,
                    error: json.msg,
                    request: {url, params},
                    response: text,
                },
                code: json.status,
            });
        }
        return json;
    }

    async authenticate(key: string, operator: string, provider: string, game: string) {
        const {nativeId, token, country, currency, nickname, brand, timestamp} = this.getCipherData(key);
        const sessionData = await this.addSessionParams(nativeId, timestamp);
        const data = await this.getBalance({
            nativeId,
            provider,
            game,
            nickname,
            sessionData,
        });
        const {currency: incomingCurrency} = data;
        const balance = this.formatBalance(data);

        if (!currency || !incomingCurrency)
            throw new Exception("Incorrect currency returned", {
                data: {
                    data,
                    currency: currency || incomingCurrency,
                    key,
                    wallet: this.wallet,
                    operator,
                    game,
                },
            });

        if (incomingCurrency.toLowerCase() !== currency)
            throw new Exception("Player currency does not match incoming currency", {
                data: {
                    data,
                    currency,
                    incomingCurrency,
                    key,
                    wallet: this.wallet,
                    operator,
                    game,
                },
            });

        if (typeof balance !== "number")
            throw new Exception("Incorrect balance returned", {
                data: {data, balance, key, wallet: this.wallet, operator, game},
            });

        return {
            nativeId,
            token: token || key,
            country,
            balance,
            brand,
            currency: currency.toLowerCase(),
            sessionData: {timestamp},
        };
    }

    async balance(player: Player, provider: string, game: string, session: ISession) {
        const {nativeId, nickname} = player;
        const timestamp = await this.getTimestampFromSession(session);
        const sessionData = await this.addSessionParams(nativeId, timestamp);
        const data = await this.getBalance({
            nativeId,
            provider,
            game,
            nickname,
            sessionData,
        });
        const balance = this.formatBalance(data);
        if (typeof balance !== "number")
            throw new Exception("Incorrect balance returned", {
                data: {data, balance, nativeId, wallet: this.wallet},
            });

        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession) {
        const {nativeId, nickname} = player;
        const {transactionId, roundId, amount, provider, game, roundFinished, type, campaignType, campaignId} = transaction;

        const timestamp = await this.getTimestampFromSession(session);
        const sessionData = await this.addSessionParams(nativeId, timestamp);

        const isWithdraw = type === "withdraw";
        const isDeposit = type === "deposit";
        const isFreeBets = campaignType === "freeBets";

        const params = {
            action: isWithdraw ? "debit" : "credit",
            remote_id: nativeId,
            username: nickname || nativeId,
            amount: isFreeBets && isWithdraw ? 0 : amount, // 0 during freerounds for withdraw transaction
            game_id_hash: Game.addProviderPrefix(this.config, provider!, game!),
            transaction_id: transactionId.replace(/-/g, ""),
            round_id: roundId.replace(/-/g, ""),
            gameplay_final: roundFinished ? 1 : 0,
            ...(campaignId && {freeround_id: campaignId}),
            ...(isWithdraw && {is_freeround_bet: isFreeBets ? 1 : 0}),
            ...(isDeposit && {
                is_freeround_win: isFreeBets ? 1 : 0,
                is_jackpot_win: 0,
            }),
            ...sessionData,
        };

        const data = await this.fetch("/", "GET", params);

        const balance = this.formatBalance(data);

        if (typeof balance !== "number")
            throw new Exception("Incorrect balance returned", {
                data: {data, balance, nativeId, transaction},
            });

        return {balance};
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession) {
        const {nativeId, nickname} = player;
        const {transactionId, game, roundId, amount, provider} = transaction;

        const timestamp = await this.getTimestampFromSession(session);
        const sessionData = await this.addSessionParams(nativeId, timestamp);

        const params = {
            action: "rollback",
            remote_id: nativeId,
            username: nickname || nativeId,
            amount,
            game_id_hash: Game.addProviderPrefix(this.config, provider!, game!),
            transaction_id: transactionId.replace(/-/g, ""),
            round_id: roundId.replace(/-/g, ""),
            ...sessionData,
        };

        const data = await this.fetch("/", "GET", params);

        const balance = this.formatBalance(data);
        if (typeof balance !== "number")
            throw new Exception("Incorrect balance returned", {
                data: {data, balance, nativeId, transaction},
            });

        return {balance};
    }
}

export default ReevoWalletAdapter;
