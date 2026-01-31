import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {Express, NextFunction, Request, RequestHandler, Response} from "express";
import Exception from "@slotify/shared/lib/Exception";
import logger from "@slotify/shared/lib/logger";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import launch, {IParamsFun, IParamsReal} from "../route/launch";
import {Player} from "../db/model/Player";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {errorCodes} from "./walletAdapter";
import {Game} from "../db/model/Game";
import {cancelCampaign, createCampaign, getAvailableBets, getCampaignByName, getFreeBetsCampaignDetails, getGameActiveFreeBetsCampaigns} from "../util/external";
import {ipFilter} from "../util/ip";
import {StatusCode} from "@slotify/shared/lib/StatusCode";

type ILauncherBodyParams = {
    demo: boolean;
    isMobile: boolean;
    gameId: string;
    playerId: string;
    lang: string;
    token: string;
    home: string;
    currency: string;
};

export type IConfig = {
    url: string;
    providerId: string;
    providerToken: string;
    secretKey: string;
    timeout?: number;
};

type ICreateFreeSpinsBodyParams = {
    freespinId: string;
    playerId: string;
    name: string;
    currency: string;
    games: string[];
    betAmount: number;
    spinAmount: number;
    expireDate: string;
};

type ICancelFreeSpinsBodyParams = {
    freespinId: string;
    playerId: string;
};

type IRequestParams = {
    partner: string;
};

const operator = "pinup";

export class PinUpWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    cipher!: Cipher;

    async init(wallet: string, api: Express, path: string, config: IConfig, whitelistedIps?: string[]) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.providerToken, this.wallet);

        api.post(path + "/partner/:partner/gameWebFrame", ipFilter(whitelistedIps), auth(this.config.secretKey), async (req: Request<IRequestParams, unknown, ILauncherBodyParams, unknown>, res: any) => {
            const demo = req.body.demo;
            const channel = req.body.isMobile ? "mobile" : "desktop";
            const game = req.body.gameId;
            const playerId = req.body.playerId;
            const language = req.body.lang;
            const token = req.body.token;
            const lobbyUrl = req.body.home;
            const brand = req.params.partner;

            let launchUrl: string;
            if (demo) {
                const launchData = clearEmpty({
                    game,
                    operator,
                    language,
                    lobbyUrl,
                    channel,
                }) as IParamsFun;
                launchUrl = await launch("fun", launchData, req);
            } else {
                const key = this.cipher.encrypt(JSON.stringify({playerId, game, brand, token, salt: Date.now()}));
                const launchData = clearEmpty({
                    game,
                    operator,
                    lobbyUrl,
                    language,
                    wallet,
                    key,
                    channel,
                }) as IParamsReal;
                launchUrl = await launch("real", launchData, req);
            }
            res.json({URL: launchUrl});
        });

        api.get(path + "/partner/:partner/games", ipFilter(whitelistedIps), auth(this.config.secretKey), async (req: Request<IRequestParams, unknown, unknown, unknown>, res: any) => {
            const games = await this.getAllGames();
            res.json({provider: this.config.providerId, gameList: games});
        });

        api.post(path + "/partner/:partner/freespin", ipFilter(whitelistedIps), auth(this.config.secretKey), async (req: Request<IRequestParams, unknown, ICreateFreeSpinsBodyParams, unknown>, res: any) => {
            try {
                const id = await this.createFreeBets(req.body);
                res.send({id});
            } catch (e: any) {
                res.status(403);
                res.json({
                    error: {
                        code: 403,
                        errorMessage: e.message,
                    },
                });
            }
        });

        api.put(path + "/partner/:partner/freespin/cancel", ipFilter(whitelistedIps), auth(this.config.secretKey), async (req: Request<IRequestParams, unknown, ICancelFreeSpinsBodyParams, unknown>, res: any) => {
            try {
                await this.closeFreeBetsCampaign(req.body);
            } catch (e: any) {
                res.status(403);
                res.json({
                    error: {
                        code: 403,
                        errorMessage: e.message,
                    },
                });
            }
        });
    }

    async authenticate(encryptedUrlKey: string): Promise<IWalletAuthenticate> {
        const {playerId: decryptedPlayerId, token: decryptedToken, game, brand} = JSON.parse(this.cipher.decrypt(encryptedUrlKey));

        const query = {token: this.config.providerToken, sessionId: decryptedToken, playerId: decryptedPlayerId, gameId: game};

        const {playerId, currency: pinUpCurrency, userName, balance} = await this.fetch("session", query, undefined, "GET");

        return {
            nativeId: playerId,
            token: decryptedToken,
            currency: pinUpCurrency.toLowerCase(),
            balance: parseFloat(balance),
            nickname: userName,
            brand,
        };
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession): Promise<IWalletBalance> {
        if (transaction.campaignType === "freeBets") {
            if (transaction.type === "deposit" && transaction.campaignData!.used === transaction.campaignData?.total) {
                const campaign = await getFreeBetsCampaignDetails(transaction.campaignId!);
                if (!campaign) {
                    throw new Exception("Couldn't find campaign name");
                }
                const freeSpinPayload = {
                    freespinId: campaign.name.replace(`${this.wallet}_`, ""), // format of campaign name is "{wallet_name}_{freeSpinId}"
                    transactionId: transaction.transactionId,
                    sessionId: session.token,
                    playerId: player.nativeId,
                    gameId: transaction.game,
                    gameRoundId: transaction.roundId,
                    amount: transaction.campaignData!.totalWin.toString(),
                };

                const query = {token: this.config.providerToken};

                const {balance} = await this.fetch("action", query, freeSpinPayload, "POST");

                return {balance: parseFloat(balance)};
            } else {
                return this.balance(player, transaction.provider!, transaction.game!, session);
            }
        } else {
            const transactionPayload: any = {
                transactionId: transaction.transactionId,
                sessionId: session.token,
                playerId: player.nativeId,
                gameId: transaction.game,
                gameRoundId: transaction.roundId,
                transactionType: transaction.type === "withdraw" ? 2 : 1,
                amount: transaction.amount.toString(),
            };

            const query = {token: this.config.providerToken};

            const {balance} = await this.fetch("action", query, transactionPayload, "POST");

            return {balance: parseFloat(balance)};
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession): Promise<IWalletBalance> {
        const transactionPayload: any = {
            transactionId: transaction.transactionId,
            sessionId: session.token,
            playerId: player.nativeId,
            gameId: transaction.game,
            gameRoundId: transaction.roundId,
            transactionType: transaction.type === "withdraw" ? -2 : -1,
        };

        const query = {token: this.config.providerToken};

        const {balance} = await this.fetch("action", query, transactionPayload, "POST");

        return {balance: parseFloat(balance)};
    }

    async balance(player: Player, _provider: string, game: string, session: ISession): Promise<IWalletBalance> {
        const query = {token: this.config.providerToken, sessionId: session.token, playerId: player.nativeId, gameId: game};

        const {balance} = await this.fetch("session", query, undefined, "GET");

        return {
            balance: parseFloat(balance),
        };
    }

    private async fetch(path: string, query: Record<string, string>, payload: any, method: string): Promise<any> {
        const url = this.addQueryToUrl(this.config.url + "/" + this.config.providerId + "/" + path, query);

        let response;
        let text;
        let json;

        try {
            const body = JSON.stringify(payload);

            response = await fetch(url, {method, body, timeout: (this.config.timeout || 15) * 1000});
            text = await response.text();
            json = JSON.parse(text);
        } catch (e) {
            throw new Exception("Couldn't fetch from wallet", {data: {error: e}});
        } finally {
            logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {
                req: payload,
                res: json || text,
                status: response?.status,
            });
        }

        // business logic
        if (response && response.status === 200 && !json.errCode) {
            return json;
        } else if (response && json.errCode) {
            const {code} = this.mapErrorCode(json);
            throw new Exception(json.errMessage || "Wallet returned error", {
                status: response.status,
                code,
            });
        } else {
            // cancellable - retriable
            logger.warn(`Wallet outgoing call returned retriable error (${this.wallet}): ${url}`, {
                req: payload,
                res: json || text,
                status: response?.status,
            });
        }

        throw new Exception(json?.errormessage || "Wallet returned error", {
            status: response?.status || StatusCode.BAD_REQUEST,
            code: "UNKNOWN",
            payload: json.errorparameters,
        });
    }

    private mapErrorCode(json: {errCode: number}): {code: string} {
        switch (json.errCode) {
            case 1:
                return {code: errorCodes.UNKNOWN};
            case 2:
                return {code: errorCodes.UNKNOWN};
            case 3:
                return {code: errorCodes.UNKNOWN};
            case 4:
                return {code: errorCodes.UNKNOWN};
            case 5:
                return {code: errorCodes.TRANSACTION_FAILED}; // questionable
            case 6:
                return {code: errorCodes.TRANSACTION_NOT_FOUND};
            case 7:
                return {code: errorCodes.INSUFFICIENT_FUNDS};
            case 8:
                return {code: errorCodes.PLAYER_UNAUTHORIZED};
            case 9:
                return {code: errorCodes.PLAYER_UNAUTHORIZED};
            case 10:
                return {code: errorCodes.SESSION_EXPIRED};
            case 11:
                return {code: errorCodes.SERVER_UNAUTHORIZED}; // questionable
            case 12:
                return {code: errorCodes.UNKNOWN};
            case 13:
                return {code: errorCodes.UNKNOWN};
            case 14:
                return {code: errorCodes.UNKNOWN};
            case 15:
                return {code: errorCodes.UNKNOWN};
            case 16:
                return {code: errorCodes.UNKNOWN};
            case 17:
                return {code: errorCodes.UNKNOWN};
            case 18:
                return {code: errorCodes.UNKNOWN}; // questionable
            default:
                return {code: errorCodes.UNKNOWN};
        }
    }

    private async getAllGames(): Promise<{freespinAvailable: boolean; gameId: string; title: string; betFactors: number[]}[]> {
        const games = [];

        for (const gameData of await Game.allGames()) {
            if (await Game.verify(gameData.game, this.wallet, operator)) {
                const gameActiveFreeBetsCampaigns = await getGameActiveFreeBetsCampaigns(gameData.game, this.wallet);
                const gameBets = await this.getGameBets(gameData);

                games.push({
                    freespinAvailable: gameActiveFreeBetsCampaigns.length > 0, // check if game has free spins
                    gameId: gameData.game,
                    title: gameData.title ? gameData.title : gameData.game,
                    betFactors: gameBets.map(bet => Math.round(bet * 100)), // sending cents here
                });
            }
        }
        return games;
    }

    private async getGameBets(gameData: Game): Promise<number[]> {
        try {
            return await getAvailableBets({
                wallet: this.wallet,
                operator,
                provider: gameData.provider,
                game: gameData.game,
                currency: "eur",
            }); // it is said that bet factors should be in EUR
        } catch (e) {
            logger.warn(`Game is not added in ${this.wallet} Game.list`, {
                message: e,
            });
            return [];
        }
    }

    private async createFreeBets({freespinId, name, currency, playerId, betAmount, spinAmount, games, expireDate}: ICreateFreeSpinsBodyParams): Promise<string> {
        const end = new Date(expireDate).getTime();

        if (isNaN(end)) {
            throw new Exception("Invalid date format");
        }

        let amount = parseFloat((betAmount / 100).toFixed(2)); // pinup send bet amount in cents
        if (!amount) {
            const {provider} = await Game.get(name);
            const gameBets = await this.getGameBets({game: name, provider} as Game);
            amount = Math.min(...gameBets);
        }

        await createCampaign({
            type: "freeBets",
            name: this.mapPinUpFreeSpinIdToName(freespinId),
            end,
            wallets: [this.wallet],
            games,
            nativeIds: [playerId],
            config: {
                bets: spinAmount,
                amount,
                currency: currency.toLowerCase(),
            },
        });

        return freespinId;
    }

    private async closeFreeBetsCampaign({freespinId}: ICancelFreeSpinsBodyParams) {
        const expiredCampaign = await getCampaignByName(this.mapPinUpFreeSpinIdToName(freespinId));

        if (!expiredCampaign) {
            throw new Exception("Attempting to close non-existing Pin Up free spins campaign", {
                data: {
                    freespinId,
                },
            });
        }
        await cancelCampaign(expiredCampaign.campaignId);
    }

    private mapPinUpFreeSpinIdToName(freeSpinId: string): string {
        return this.wallet + "_" + freeSpinId;
    }

    private addQueryToUrl(baseUrl: string, query: Record<string, string>): string {
        const url = new URL(baseUrl);

        Object.entries(query).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        return url.toString();
    }
}

function auth(secretKey: string): RequestHandler {
    return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
        const authHeader = req.headers.authorization;

        if (authHeader !== secretKey) {
            res.status(401).json({error: "Invalid token"});
        } else {
            next();
        }
    };
}
