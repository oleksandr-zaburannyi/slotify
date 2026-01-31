import {Express, NextFunction, Request, Response} from "express";
import * as crypto from "crypto";
import Exception from "@slotify/shared/lib/Exception";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import logger from "@slotify/shared/lib/logger";
import launch from "../route/launch";
import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {Game} from "../db/model/Game";
import {cancelCampaign, createCampaign, getAvailableBetsBulk, getCampaignByName, getFreeBetsCampaignDetails, getRgsCurrencies, getSettings} from "../util/external";
import {ipFilter} from "../util/ip";
import {errorCodes} from "./walletAdapter";

type ILaunchBody = {
    account?: string;
    game: string;
    brand: string;
    token?: string;
    language: string;
    currency?: string;
    isDemo: boolean;
    platform: "MOBILE" | "DESKTOP";
    closeUrl?: string;
    lobbyUrl?: string;
    cashierUrl?: string;
    extraData?: any;
};

type IHistoryBody = {
    round: string;
    brand: string;
    game: string;
};

type IGameListBody = {
    brand: string;
};

type IAuthenticateRequest = {
    token: string;
    extraData: object | null;
};
type IAuthenticateResponse = {
    totalBalance: number;
    session: string;
};

type IBalanceRequest = {
    session: string;
    extraData: object | null;
};
type IBalanceResponse = {
    totalBalance: number;
};

type IBetRequest = {
    round: string;
    id: string;
    session: string;
    game: string;
    amount: number;
    jackpotBetContribution: number;
    extraData: object | null;
};

type IResultRequest = {
    round: string;
    id: string;
    roundClosed: boolean;
    game: string;
    amount: number;
    session: string;
    extraData: object | null;
};

type IFreeSpinResult = {
    bonus: string;
    id: string;
    amount: number;
    game: string;
    session: string;
    extraData: object | null;
};

type ICashDrop = {
    referenceRound: string | null;
    referenceBet: string | null;
    id: string;
    amount: number;
    account: string;
    currency: string;
    targetCurrency?: string;
    provider: string;
    brand: string;
    extraData: object | null;
    type: "TOURNAMENT_WIN" | "PRIZE_DROP" | "OTHER";
};

type IJackpotWin = {
    referenceRound: string | null;
    referenceBet: string | null;
    id: string;
    session: string;
    game: string;
    amount: number;
    isProgressive: boolean;
    extraData: object | null;
};

type IRollbackRequest = {
    round: string;
    session: string;
    id: string;
    extraData: object | null;
};

type IStakeValuesBody = {
    brand: string;
    currencies: string[];
    game: string;
};

type IGiveBonusBody = {
    bonus: string;
    game: string;
    brand: string;
    account: string;
    type: "FREE_SPINS" | "BONUS_BUY";
    stakeValue: number;
    currency: string;
    count: number;
    startDate: number;
    endDate: number;
    extraData: object | null;
};

type IBonusCancelBody = {
    bonus: string;
    brand: string;
};

interface IConfig {
    privateKey: string;
    brands: Record<string, {url: string; publicKey: string}>;
    timeout?: number;
    forceLanguage?: string;
}

const failedTransactionErrorCodes: string[] = ["DUPLICATE_TRANSACTION", "BET_DOES_NOT_EXIST", "USER_DOES_NOT_EXIST", "INVALID_CURRENCY", "INVALID_GAME", "ALREADY_CLOSED_ROUND", "BLOCKED_PLAYER", "GENERAL_ERROR"];

const operator = "badhombre";

export class BadHombreWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;

    private cipher?: Cipher;

    private sendError(res: Response, description: string) {
        const payload = {hasErrors: true, errors: [{code: "GENERAL_ERROR", description}], body: {}};
        res.set("X-Digital-Signature", this.generateSignature(JSON.stringify(payload)));
        res.status(200).json(payload);
    }

    private sendSuccess(res: Response, body: any) {
        const payload = {hasErrors: false, errors: [], body};
        res.set("X-Digital-Signature", this.generateSignature(JSON.stringify(payload)));
        res.status(200).json(payload);
    }

    private getBrandConfig(brand: string) {
        if (!this.config.brands?.[brand]) throw new Exception(`BadHombre brand ${brand} not configured`, {data: {brand}});
        return this.config.brands[brand];
    }

    private validateServer(req: Request, res: Response, next: NextFunction) {
        const verify = crypto.createVerify("SHA256");
        verify.update((req as any).rawBody);
        verify.end();

        const brand: string = req.body.brand;
        const publicKey = this.getBrandConfig(brand).publicKey;
        if (!publicKey) return this.sendError(res, `No public key found for ${brand} brand`);

        const isValid = verify.verify(publicKey, req.headers["x-digital-signature"] as string, "base64");
        if (!isValid) return this.sendError(res, `Invalid key for ${brand} brand`);

        return next();
    }

    private getNativeId(account: string, currency: string) {
        return `${account}_${currency}`;
    }

    private getAccount(nativeId: string) {
        return nativeId.substring(nativeId.lastIndexOf("_") + 1);
    }

    private getCampaignName(bonus: string) {
        return `badhombre_${bonus}`;
    }

    private getBonus(campaignName: string) {
        return campaignName.substring(campaignName.lastIndexOf("_") + 1);
    }

    async init(wallet: string, api: Express, path: string, config: IConfig, whitelistedIps?: string[]) {
        this.wallet = wallet;
        this.config = config;
        if (!this.config.privateKey) throw new Exception("Private key is required");
        this.cipher = new Cipher(this.config.privateKey, this.wallet);

        api.post(path + "/api/game/launch", ipFilter(whitelistedIps), this.validateServer.bind(this), async (req: Request<unknown, unknown, ILaunchBody>, res: Response) => {
            try {
                const mode = req.body.isDemo ? "fun" : "real";
                const brand = req.body.brand;
                const currency = req.body.currency?.toLowerCase();
                const game = req.body.game;
                const language = this.config.forceLanguage || req.body.language;
                const lobbyUrl = req.body.lobbyUrl;
                const depositUrl = req.body.cashierUrl;
                const token = req.body.token;
                const nativeId = this.getNativeId(req.body.account || "", req.body.currency || "");
                const key = mode === "real" ? this.cipher!.encrypt(JSON.stringify({nativeId, brand, currency, token})) : undefined;

                const url: string = await launch(mode, {wallet: this.wallet, operator, lobbyUrl, depositUrl, language, game, theme: brand, key}, req);
                this.sendSuccess(res, {url});
            } catch (e) {
                this.sendError(res, e instanceof Exception ? e.message : "Unknown error");
            }
        });

        api.post(path + "/api/game/history", ipFilter(whitelistedIps), this.validateServer.bind(this), async (req: Request<unknown, unknown, IHistoryBody>, res) => {
            const operator = "badhombre";
            const roundId = req.body.round;
            const game = req.body.game;

            try {
                const url: string = await launch("replay", {roundId, game, operator}, req);
                this.sendSuccess(res, {url});
            } catch (e) {
                this.sendError(res, e instanceof Exception ? e.message : "Unknown error");
            }
        });

        api.post(path + "/api/game/list", ipFilter(whitelistedIps), this.validateServer.bind(this), async (req: Request<unknown, unknown, IGameListBody>, res: Response) => {
            try {
                const categories = {
                    "live": "OTHERS_LIVE",
                    "lottery": "LOTTERY",
                    "poker": "LIVE_POKER",
                    "slot": "SLOTS",
                    "tableGame": "OTHERS_TABLE",
                    "videoPoker": "VIDEO_POKER",
                    "other": "OTHERS",
                };
                const brand = req.body.brand;
                const games = [];
                const currencies = await getRgsCurrencies();
                for (const game of await Game.allGames()) {
                    if (!(await Game.verify(game.game, wallet, operator, brand))) continue;

                    const {gameVariant} = await getSettings({wallet: this.wallet, brand});
                    games.push({
                        subProvider: game.provider,
                        id: game.game,
                        name: game.title || game.game,
                        category: game.type ? categories[game.type] : "DEFAULT",
                        enabled: true,
                        blockedCountries: [],
                        supportedCurrencies: currencies.map(currency => currency.toUpperCase()),
                        supportedPlatforms: ["DESKTOP", "MOBILE"],
                        supportedLanguages: null,
                        features: ["DEMO", "FREE_SPINS"],
                        backgroundUrl: null,
                        thumbnailUrl: null,
                        rtp: gameVariant || "default",
                        extraData: null,
                    });
                }
                this.sendSuccess(res, games);
            } catch (e) {
                this.sendError(res, e instanceof Exception ? e.message : "Unknown error");
            }
        });

        api.post(path + "/api/game/stakeValues", ipFilter(whitelistedIps), this.validateServer.bind(this), async (req: Request<unknown, unknown, IStakeValuesBody>, res: Response) => {
            try {
                const {brand, game, currencies} = req.body;
                const body: {currency: string; values: number[]}[] = [];

                const {provider} = await Game.get(game);
                const betsPerGame = await getAvailableBetsBulk({provider, operator, wallet: this.wallet, brand, games: [game]});
                for (const [currency, bets] of Object.entries(betsPerGame[game])) {
                    const values: number[] = currencies.includes(currency.toUpperCase()) ? bets : [];
                    body.push({currency: currency.toUpperCase(), values});
                }

                this.sendSuccess(res, body);
            } catch (e) {
                this.sendError(res, e instanceof Exception ? e.message : "Unknown error");
            }
        });

        api.post(path + "/api/game/bonus/give", ipFilter(whitelistedIps), this.validateServer.bind(this), async (req: Request<unknown, unknown, IGiveBonusBody>, res: Response) => {
            try {
                const {brand, game, account, bonus, type, stakeValue, startDate, endDate, count, currency} = req.body;
                if (type !== "FREE_SPINS") throw new Exception("Bonus type not supported");

                await createCampaign({
                    type: "freeBets",
                    name: this.getCampaignName(bonus),
                    config: {bets: count, amount: stakeValue, currency: currency.toLowerCase()},
                    start: startDate ? Math.round(startDate * 1000) : undefined,
                    end: endDate ? Math.round(endDate * 1000) : undefined,
                    wallets: [this.wallet],
                    brands: [brand],
                    nativeIds: [this.getNativeId(account, currency)],
                    games: [game],
                });

                this.sendSuccess(res, {});
            } catch (e) {
                this.sendError(res, e instanceof Exception ? e.message : "Unknown error");
            }
        });

        api.post(path + "/api/game/bonus/cancel", ipFilter(whitelistedIps), this.validateServer.bind(this), async (req: Request<unknown, unknown, IBonusCancelBody>, res) => {
            try {
                const campaign = await getCampaignByName(this.getCampaignName(req.body.bonus));
                if (!campaign) throw new Exception("Campaign not found", {data: {...req.body}});
                await cancelCampaign(campaign?.campaignId);
                this.sendSuccess(res, {});
            } catch (e) {
                this.sendError(res, e instanceof Exception ? e.message : "Unknown error");
            }
        });
    }

    private generateSignature(data: string): string {
        const sign = crypto.createSign("SHA256");
        sign.update(data);
        sign.end();
        return sign.sign(this.config.privateKey, "base64");
    }

    private async fetch<TRequest extends Record<string, any>, TResponse>(path: string, params: TRequest, brand: string): Promise<TResponse> {
        let retry = 2;
        do {
            const data = {...params, timestamp: Math.floor(Date.now() / 1000)};
            const body = JSON.stringify(data);
            const url = this.getBrandConfig(brand).url + path;
            const headers: Record<string, string> = {};

            headers["Content-Type"] = "application/json";
            headers["X-Digital-Signature"] = this.generateSignature(body);

            let json;
            let text;

            try {
                const response = await fetch(url, {method: "POST", body, headers, timeout: (this.config.timeout || 15) * 1000});
                text = await response.text();
                json = JSON.parse(text);
            } catch (error) {
                throw new Exception("Couldn't fetch from wallet", {data: {wallet: this.wallet, error}});
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: data, res: json || text});
            }

            if (json.hasErrors) {
                const code = json.errors[0].code;
                if (code === "NOT_ENOUGH_MONEY") {
                    throw new Exception("Insufficient funds", {code: errorCodes.INSUFFICIENT_FUNDS});
                }
                if (failedTransactionErrorCodes.includes(code)) {
                    throw new Exception("Insufficient funds", {code: errorCodes.TRANSACTION_FAILED});
                }
                if (retry === 0) {
                    throw new Exception("Unknown error", {code: errorCodes.UNKNOWN});
                }
            } else if (json.body) {
                return json.body;
            } else {
                throw new Exception("Couldn't fetch from wallet", {data: {wallet: this.wallet, json}});
            }
        } while (--retry > 0);
        throw new Exception("Unknown error");
    }

    private getCipherData = (key: string) => {
        try {
            return JSON.parse(this.cipher!.decrypt(key));
        } catch {
            throw new Exception("Incorrect authentication key", {data: {key, wallet: this.wallet}});
        }
    };

    async authenticate(key: string) {
        const {nativeId, brand, currency, token} = this.getCipherData(key);
        const data: IAuthenticateRequest = {
            token,
            extraData: null,
        };
        const {totalBalance, session} = await this.fetch<IAuthenticateRequest, IAuthenticateResponse>("/api/game/authorize", data, brand);

        return {nativeId, token: session, balance: totalBalance, brand, currency};
    }

    async balance(player: Player, provider: string, game: string, session: ISession) {
        const data = {
            session: session.token,
            extraData: null,
        };
        const {totalBalance} = await this.fetch<IBalanceRequest, IBalanceResponse>("/api/game/balance", data, player.brand!);
        return {balance: totalBalance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession, originalSession?: ISession): Promise<IWalletBalance> {
        if (transaction.category === "promo") {
            const types = {
                "tournament": "TOURNAMENT_WIN",
                "prizeDrop": "PRIZE_DROP",
            } as const;
            const params = {
                referenceRound: transaction.roundId,
                referenceBet: null,
                id: transaction.transactionId,
                amount: transaction.amount,
                account: this.getAccount(player.nativeId),
                currency: player.currency.toUpperCase(),
                provider: transaction.provider!,
                brand: player.brand!,
                type: types[transaction.campaignType! as keyof typeof types] || "OTHER",
                extraData: null,
            } as const;
            const {totalBalance} = await this.fetch<ICashDrop, IBalanceResponse>("/api/game/bonus/cashdrop", params, player.brand!);
            return {balance: totalBalance};
        } else if (transaction.campaignType === "freeBets") {
            if (transaction.type === "deposit" && transaction.campaignData!.used === transaction.campaignData?.total) {
                const campaign = await getFreeBetsCampaignDetails(transaction.campaignId!);
                if (!campaign) throw new Exception("Couldn't find campaign name");
                const bonus = this.getBonus(campaign.name);
                const params = {
                    bonus,
                    id: transaction.transactionId,
                    amount: transaction.campaignData!.totalWin,
                    game: transaction.game!,
                    session: session.token,
                    extraData: null,
                };
                const {totalBalance} = await this.fetch<IFreeSpinResult, IBalanceResponse>("/api/game/bonus/result", params, player.brand!);
                return {balance: totalBalance};
            } else {
                return this.balance(player, transaction.provider!, transaction.game!, session);
            }
        } else if (transaction.type === "withdraw") {
            const data = {
                round: transaction.roundId,
                id: transaction.transactionId,
                session: (originalSession || session).token,
                game: transaction.game!,
                amount: transaction.amount,
                jackpotBetContribution: transaction.jackpotAmount || 0,
                extraData: null,
            };
            const {totalBalance} = await this.fetch<IBetRequest, IBalanceResponse>("/api/game/bet", data, player.brand!);
            return {balance: totalBalance};
        } else {
            if (transaction.jackpotAmount && transaction.jackpotAmount > 0) {
                const data = {
                    referenceRound: transaction.roundId,
                    referenceBet: null,
                    id: transaction.transactionId,
                    session: session.token,
                    game: transaction.game!,
                    amount: transaction.jackpotAmount || 0,
                    isProgressive: true,
                    extraData: null,
                };
                await this.fetch<IJackpotWin, IBalanceResponse>("/api/game/jackpot", data, player.brand!);
            }
            const data = {
                round: transaction.roundId,
                roundClosed: transaction.roundFinished,
                id: transaction.transactionId,
                session: (originalSession || session).token,
                game: transaction.game!,
                amount: transaction.amount,
                extraData: null,
            };
            const {totalBalance} = await this.fetch<IResultRequest, IBalanceResponse>("/api/game/result", data, player.brand!);
            return {balance: totalBalance};
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession, originalSession?: ISession): Promise<IWalletBalance> {
        const data = {
            round: transaction.roundId,
            session: (originalSession || session).token,
            id: transaction.transactionId,
            extraData: null,
        };

        const {totalBalance} = await this.fetch<IRollbackRequest, IBalanceResponse>("/api/game/rollback", data, player.brand!);
        return {balance: totalBalance};
    }
}

export default BadHombreWalletAdapter;
