import IWalletAdapter, {IWalletAuthenticate, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {Express, Request} from "express";
import Exception from "@slotify/shared/lib/Exception";
import logger from "@slotify/shared/lib/logger";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import launch, {IParamsFun, IParamsReal} from "../route/launch";
import {Player} from "../db/model/Player";
import {StatusCode} from "@slotify/shared/lib/StatusCode";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {errorCodes} from "./walletAdapter";
import * as crypto from "crypto";
import {Game} from "../db/model/Game";
import {cancelCampaign, createCampaign, getCampaignByName, getFreeBetsCampaignDetails} from "../util/external";
import {v4} from "uuid";

type ILauncherQueryParams = {
    partnerId: string;
    gameId: string;
    token: string;
    currency: string;
    lang: string;
    platform: string;
    demo: string;
    returnUrl: string;
};

type GrrrGameType =
    | "slots"
    | "table"
    | "roulette"
    | "live"
    | "casino"
    | "instantWin"
    | "inHouse"
    | "scratchGames"
    | "videoPoker"
    | "liveCasino"
    | "liveRoulette"
    | "liveBlackjack"
    | "otherGames"
    | "allBuyFeatureGames"
    | "jackpotGames"
    | "betting";

type IApiQueryParams = {
    partnerId: string;
    action: string;
};

type IActionBodyParams = {
    partnerId: string;
    action: string;
};

type CreateFreeSpinsBodyParams = IActionBodyParams & {
    freeSpinId: string;
    playerId: string;
    currency: string;
    amount: number;
    games: string[];
    expireAt?: string;
};

type CancelFreeSpinsBodyParams = IActionBodyParams & {
    freeSpinId: string;
};

export type IConfig = {
    brands: Record<string, {url: string; secretKey: string}>;
    providerPartnerId: string;
    thumbnailUrl: string;
    timeout?: number;
};

type IGrrrApiMethod = "action" | "api";

const operator = "grrr";

export class GrrrWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    cipher!: Cipher;

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(Object.values(this.config.brands || {})[0]?.secretKey || this.wallet, this.wallet);

        api.get(path + "/launcher", async (req: Request<unknown, unknown, unknown, ILauncherQueryParams>, res: any) => {
            const partnerId = req.query.partnerId; // brand
            const game = req.query.gameId;
            const token = req.query.token;
            //const currency = req.query.currency;
            const language = req.query.lang;
            const demo = Number.parseInt(req.query.demo);
            const channel = req.query.platform;
            const lobbyUrl = req.query.returnUrl;
            const theme = partnerId;

            let launchUrl: string;
            if (demo === 1) {
                const launchData = clearEmpty({
                    game,
                    operator,
                    language,
                    lobbyUrl,
                    channel,
                    theme,
                }) as IParamsFun;
                launchUrl = await launch("fun", launchData, req);
            } else {
                const key = this.cipher.encrypt(JSON.stringify({partnerId, token, salt: Date.now()}));
                const launchData = clearEmpty({
                    game,
                    operator,
                    lobbyUrl,
                    language,
                    wallet,
                    key,
                    channel,
                    theme,
                }) as IParamsReal;
                launchUrl = await launch("real", launchData, req);
            }
            res.redirect(launchUrl);
        });

        api.get(path + "/api", async (req: Request<unknown, unknown, unknown, IApiQueryParams>, res: any) => {
            if (req.query.action === "gameList") {
                const games = await this.getAllGames();
                res.json(games);
            } else {
                res.status(404).send("Action not found");
            }
        });

        api.post(path + "/action", async (req: Request<unknown, unknown, IActionBodyParams, unknown>, res: any) => {
            if (req.body.action === "activateFreeSpin") {
                try {
                    await this.createFreeBets(req.body as CreateFreeSpinsBodyParams);
                    res.send();
                } catch (e: any) {
                    res.status(403);
                    res.json({
                        errorCode: "INVALID_PARAMETERS",
                        errorMessage: e.message,
                    });
                }
            } else {
                res.status(404).send("Action not found");
            }
        });

        api.post(path + "/api", async (req: Request<unknown, unknown, IActionBodyParams, unknown>, res: any) => {
            if (req.body.action === "cancelFreeSpin") {
                try {
                    await this.closeFreeBetsCampaign(req.body as CancelFreeSpinsBodyParams);
                } catch (e: any) {
                    res.status(403);
                    res.json({
                        errorCode: "INVALID_PARAMETERS",
                        errorMessage: e.message,
                    });
                }
            } else {
                res.status(404).send("Action not found");
            }
        });
    }

    async authenticate(encryptedUrlKey: string): Promise<IWalletAuthenticate> {
        const {partnerId, token: decryptedToken} = JSON.parse(this.cipher.decrypt(encryptedUrlKey));

        const initPayload = {
            partnerId: this.config.providerPartnerId,
            token: decryptedToken,
            action: "init",
        };

        const {playerId, token, currency: grrrCurrency, balance} = await this.fetch("action", partnerId, initPayload);

        return {
            nativeId: playerId,
            token,
            brand: partnerId,
            currency: grrrCurrency.toLowerCase(),
            balance: parseFloat(balance),
        };
    }

    async transaction(player: Player, transaction: IWalletTransaction): Promise<IWalletBalance> {
        if (transaction.campaignType === "freeBets") {
            if (transaction.type === "deposit" && transaction.campaignData!.used === transaction.campaignData?.total) {
                const campaign = await getFreeBetsCampaignDetails(transaction.campaignId!);
                if (!campaign) {
                    throw new Exception("Couldn't find campaign name");
                }
                const freeSpinPayload = {
                    partnerId: this.config.providerPartnerId,
                    action: "freeSpin",
                    freeSpinId: campaign.name.replace(`${this.wallet}_`, ""), // format of campaign name is "{wallet_name}_{freeSpinId}"
                    amount: transaction.campaignData!.totalWin.toString(),
                };

                const {balance} = await this.fetch("action", player.brand!, freeSpinPayload);
                return {balance: parseFloat(balance)};
            } else {
                return this.balance(player);
            }
        } else {
            const transactionPayload: any = {
                partnerId: this.config.providerPartnerId,
                action: transaction.type === "withdraw" ? "stake" : "win",
                gameId: transaction.game,
                playerId: player.nativeId,
                roundId: transaction.roundId,
                transactionId: transaction.transactionId,
                amount: transaction.amount.toString(),
                roundClosed: transaction.roundFinished,
            };

            const {balance} = await this.fetch("action", player.brand!, transactionPayload);

            return {balance: parseFloat(balance)};
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction): Promise<IWalletBalance> {
        const transactionPayload = {
            partnerId: this.config.providerPartnerId,
            action: "rollback",
            originalTransactionId: transaction.transactionId,
            transactionId: v4(),
        };

        const {balance} = await this.fetch("action", player.brand!, transactionPayload);
        return {balance: parseFloat(balance)};
    }

    async balance(player: Player): Promise<IWalletBalance> {
        const transactionPayload = {
            partnerId: this.config.providerPartnerId,
            action: "balance",
            playerId: player.nativeId,
        };

        const {balance} = await this.fetch("action", player.brand!, transactionPayload);

        return {balance: parseFloat(balance)};
    }

    private async fetch(apiMethod: IGrrrApiMethod, brand: string, payload: any): Promise<any> {
        const url = this.config.brands[brand].url + "/" + apiMethod + "/";
        const method = "POST";
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Signature": this.getSignatureHeader(payload, brand),
        };

        let response;
        let text;
        let json;

        try {
            const body = JSON.stringify(payload);

            response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
            text = await response.text();
            json = JSON.parse(text);
        } catch (e) {
            throw new Exception("Couldn't fetch from wallet", {data: {error: e}});
        } finally {
            logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {
                headers,
                req: payload,
                res: json || text,
                status: response?.status,
            });
        }

        if (response && response.status === 200) {
            // business logic
            if (json.errorCode === undefined) {
                return json;
            } else {
                const {code} = this.mapErrorCode(json);
                throw new Exception(json.errormessage || "Wallet returned error", {
                    status: response.status,
                    code,
                });
            }
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

    private getSignatureHeader(payload: any, brand: string) {
        const message = JSON.stringify(payload);
        return crypto.createHmac("sha256", this.config.brands[brand].secretKey).update(message).digest("hex");
    }

    private mapErrorCode(json: {errorCode: string}): {code: string} {
        switch (json.errorCode) {
            case "10000":
                return {code: errorCodes.UNKNOWN};
            case "10001":
                return {code: errorCodes.PLAYER_UNAUTHORIZED};
            case "10002":
                return {code: errorCodes.INSUFFICIENT_FUNDS};
            case "10003":
                return {code: errorCodes.TRANSACTION_FAILED};
            case "10004":
                return {code: errorCodes.TRANSACTION_FAILED};
            case "10005":
                return {code: errorCodes.TRANSACTION_FAILED};
            case "10006":
                return {code: errorCodes.TRANSACTION_FAILED};
            case "10007":
                return {code: errorCodes.TRANSACTION_FAILED};
            case "10008":
                return {code: errorCodes.TRANSACTION_FAILED};
            case "10009":
                return {code: errorCodes.PLAYER_UNAUTHORIZED};
            case "10010":
                return {code: errorCodes.PLAYER_UNAUTHORIZED};
            case "10011":
                return {code: errorCodes.TRANSACTION_NOT_FOUND};
            case "10012":
                return {code: errorCodes.CLOSE_ROUND};
            default:
                return {code: errorCodes.UNKNOWN};
        }
    }

    private async getAllGames(): Promise<{id: string; name: string; type: GrrrGameType; image: string}[]> {
        const games = [];

        for (const gameData of await Game.allGames()) {
            if (await Game.verify(gameData.game, this.wallet, operator)) {
                games.push({
                    id: gameData.game,
                    name: gameData.title ? gameData.title : gameData.game,
                    type: this.mapGameType(gameData.type),
                    image: this.config.thumbnailUrl.replace("${game}", gameData.game),
                });
            }
        }
        return games;
    }

    private mapGameType(providerType: "live" | "lottery" | "poker" | "slot" | "tableGame" | "videoPoker" | "other" | undefined): GrrrGameType {
        switch (providerType) {
            case "live":
                return "live";
            case "lottery":
                return "scratchGames";
            case "poker":
                return "table";
            case "slot":
                return "slots";
            case "tableGame":
                return "table";
            case "videoPoker":
                return "videoPoker";
            case "other":
                return "otherGames";
            default:
                return "otherGames";
        }
    }

    private async createFreeBets({partnerId, freeSpinId, playerId, amount, games, expireAt}: CreateFreeSpinsBodyParams) {
        const end = expireAt === undefined ? undefined : new Date(expireAt).getTime();

        await createCampaign({
            type: "freeBets",
            name: this.mapGrrrFreeSpinIdToName(freeSpinId),
            end,
            wallets: [this.wallet],
            brands: [partnerId],
            games,
            nativeIds: [playerId],
            config: {
                bets: amount,
                amount: 0.2,
                currency: "eur",
            },
        });
    }

    private async closeFreeBetsCampaign({freeSpinId}: CancelFreeSpinsBodyParams) {
        const expiredCampaign = await getCampaignByName(this.mapGrrrFreeSpinIdToName(freeSpinId));

        if (!expiredCampaign) {
            throw new Exception("Attempting to close non-existing Relax free spins campaign", {
                data: {
                    freeSpinId,
                },
            });
        }
        await cancelCampaign(expiredCampaign.campaignId);
    }

    private mapGrrrFreeSpinIdToName(freeSpinId: string): string {
        return this.wallet + "_" + freeSpinId;
    }
}

export default GrrrWalletAdapter;
