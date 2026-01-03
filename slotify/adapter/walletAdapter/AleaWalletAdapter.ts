import Exception from "@slotify/shared/lib/Exception";
import * as crypto from "crypto";
import fetch from "@slotify/shared/lib/fetch";
import {Express, Request, Response} from "express";
import Cipher from "@slotify/shared/lib/Cipher";
import launch from "../route/launch";
import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletTransaction} from "./IWalletAdapter";
import {errorCodes} from "./walletAdapter";
import {Player} from "../db/model/Player";
import logger from "@slotify/shared/lib/logger";
import {cancelCampaign, createCampaign, getAvailableBets, getCampaignByName, getFreeBetsCampaignDetails, getFreeBetsPlayerDetails} from "../util/external";
import {round} from "@slotify/shared/lib/round";
import {ReportExclusion} from "../db/model/ReportExclusion";
import {Game} from "../db/model/Game";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Transaction} from "../db/model/Transaction";
import {Session} from "../db/model/Session";

type ILaunchQuery = {
    gameCode: string;
    country: string;
    currency: string;
    device: string;
    locale: string;
    gameMode: "DEMO" | "REAL";
    sessionId?: string;
    lobbyUrl: string;
    operatorCode: string;
    casinoCode: string;
};

type IAuthenticateResponse = {
    playerId: string;
    isTest: boolean;
    country: string;
    currency: string;
    casinoCode: string;
    operatorCode: string;
};

type IBalanceResponse = {
    realBalance: number;
    bonusBalance: number;
};

type ITransactionBody = {
    type: "BET" | "WIN";
    id: string;
    amount: number;
    currency: string;
    gameCode: string;
    round: {
        id: string;
        status: "IN_PROGRESS" | "COMPLETED";
        liveGameTableId?: string;
    };
};

type ITransactionResponse = {
    status: "SUCCESS";
    id: string;
    realBalance: number;
    bonusBalance: number;
    realAmount: number;
    bonusAmount: number;
};

type IRollbackBody = {
    type: "ROLLBACK";
    betTransactionId: string;
    amount: number;
    currency: string;
    gameCode: string;
    round: {
        id: string;
        status: "COMPLETED";
        liveGameTableId?: string;
    };
};

type IFreeSpinsBody = {
    playerId: string;
    bonusId: string;
    campaignId?: string;
    currency: string;
    games: {
        id: string;
        device?: string;
    }[];
    casinoCode: string;
    operatorCode: string;
    level: number;
    amount: number;
    wageringRequirement?: number;
    startAt?: string;
    expireAt?: string;
};

type IPromoPayoutBody = {
    type: "PROMO_PAYOUT";
    id: string;
    bonusId: string;
    cost: number;
    winAmount: number;
    currency: string;
    gameCode: string;
    round: {
        id: string;
        status: "COMPLETED";
        liveGameTableId?: string;
    };
};

interface IConfig {
    url: string;
    secretKey: string;
    timeout?: number;
}

const campaignPrefix = "alea-api_";

function formatToISO8601(input: string) {
    // Example input: "20250908T000000Z"
    const match = input.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) throw new Error("Invalid format");

    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}
export class AleaWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    private cipher?: Cipher;

    private calculateChecksum(checksum: string) {
        return `SHA-512=${crypto.createHash("sha512").update(checksum).digest("hex")}`;
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        api.get(path + "/launch", async (req: Request<unknown, unknown, unknown, ILaunchQuery>, res: Response) => {
            const game = req.query.gameCode;
            const language = req.query.locale;
            const lobbyUrl = req.query.lobbyUrl;
            const mode = req.query.gameMode === "DEMO" ? "fun" : "real";
            const operator = req.query.operatorCode || "demo";
            const brand = req.query.casinoCode;
            const sessionId = req.query.sessionId;
            const currency = req.query.currency;
            const country = req.query.country?.toLowerCase();
            const theme = brand;
            const key = mode === "real" ? this.cipher!.encrypt(JSON.stringify({sessionId, timestamp: Date.now()})) : `::${currency.toLowerCase()}::${country}:${brand}:`;

            const launchUrl = await launch(mode, {wallet, lobbyUrl, language, game, operator, key, theme}, req);
            res.redirect(launchUrl);
        });

        api.post(path + "/free-spins", async (req: Request<unknown, unknown, IFreeSpinsBody>, res: Response) => {
            const body = (req as any).rawBody || "";
            if (req.headers["digest"] !== this.calculateChecksum(body + this.config.secretKey)) {
                res.status(500).json({status: "DENIED", code: "INVALID_REQUEST"});
                return;
            }

            const wallets = [wallet];
            const operator = req.body.operatorCode;
            const brand = req.body.casinoCode;
            const name = campaignPrefix + req.body.bonusId;
            const baseCurrency = process.env.BASE_CURRENCY!;
            const game = req.body.games[0].id;
            if (req.body.games.length > 1) {
                res.status(400).json({"status": "DENIED", "code": "NOT_SUPPORTED"});
                return;
            }
            const {provider} = await Game.get(game);
            const bets = req.body.amount;
            const betLevels = await getAvailableBets({wallet, operator, brand, provider, game, currency: baseCurrency});
            if (req.body.level === undefined || req.body.level > betLevels.length) {
                res.status(500).json({"status": "ERROR", "code": "INVALID_REQUEST"});
                return;
            }
            const amount = betLevels[req.body.level - 1];
            const start = req.body.startAt ? new Date(req.body.startAt).getTime() : undefined;
            const end = req.body.expireAt ? new Date(req.body.expireAt).getTime() : undefined;
            const nativeIds = [req.body.playerId];

            try {
                if (await getCampaignByName(name)) {
                    res.status(400).json({"status": "DENIED", "code": "NOT_SUPPORTED"});
                    return;
                }
                const data = {type: "freeBets", name, start, end, wallets, providers: [provider], games: [game], nativeIds, config: {bets, amount, currency: baseCurrency}};
                const id = await createCampaign(data);
                res.json({id});
            } catch (error) {
                if (error instanceof Exception) {
                    logger.warn("Error creating campaign for Alea", {error});
                    res.status(500).json({"status": "ERROR", "code": "INVALID_REQUEST"});
                    return;
                }
                throw error;
            }
        });

        api.delete(path + "/free-spins/:bonusId", async (req: Request, res: Response) => {
            if (req.headers["digest"] !== this.calculateChecksum(req.params.bonusId + this.config.secretKey)) {
                res.status(500).json({status: "DENIED", code: "INVALID_REQUEST"});
                return;
            }

            const name = campaignPrefix + req.params.bonusId;

            try {
                const campaign = await getCampaignByName(name);
                if (!campaign) {
                    res.status(400).json({"status": "WARN", "code": "BONUS_NOT_FOUND"});
                    return;
                }
                await cancelCampaign(campaign.campaignId);
                res.status(204).send(); //Response body is empty body when freespins were canceled successfully
            } catch (error) {
                if (error instanceof Exception) {
                    logger.warn("Error creating campaign for Alea", {error});
                    res.status(400).json({"status": "ERROR", "code": "INVALID_REQUEST"});
                    return;
                }
                throw error;
            }
        });

        api.get(path + "/sessions", async (req: Request, res: Response) => {
            const queryString = req.originalUrl.split("?")[1] || "";
            if (req.headers["digest"] !== this.calculateChecksum(queryString + this.config.secretKey)) {
                res.status(500).json({status: "DENIED", code: "INVALID_REQUEST"});
                return;
            }

            const dateFrom: string = formatToISO8601(req.query.dateFrom as string);
            const dateTo: string = formatToISO8601(req.query.dateTo as string);
            const pageSize: number = parseInt(req.query.pageSize as string, 10);
            const pageNumber: number = parseInt(req.query.pageNumber as string, 10);

            const rawSessions = await getConnection("replica")
                .manager.createQueryBuilder(Session, "session")
                .select(["session.playerId", "session.sessionId", "session.data", "session.token"])
                .leftJoin(Player, "player", "player.id = session.playerId")
                .andWhere("player.wallet = :wallet", {wallet})
                .andWhere('session."createdAt" >= :dateFrom', {dateFrom})
                .andWhere('session."createdAt" < :dateTo', {dateTo})
                .getMany();

            const sessions = [];

            for (const {playerId, sessionId, data, token} of rawSessions.slice(pageSize * (pageNumber - 1), pageSize * pageNumber)) {
                const {nativeId} = await Player.findOneByOrFail({id: playerId});
                const rows = await getConnection("replica").query(
                    `
                        select sum(amount) as amount, type, game, "campaignType"
                        from adapter_transaction
                        where "sessionId" = $1
                        group by type, game, "campaignType";
                    `,
                    [sessionId],
                );

                const games = [];
                let totalBet: number = 0;
                let totalWin: number = 0;
                let totalPromoPayout: number = 0;

                for (const row of rows) {
                    games.push(row.game);
                    if (row.type === "withdraw") {
                        totalBet += parseFloat(row.amount);
                    } else {
                        if (row.campaignType) {
                            totalPromoPayout += parseFloat(row.amount);
                        } else {
                            totalWin += parseFloat(row.amount);
                        }
                    }
                }
                sessions.push({sessionId: token, currency: data?.curency, playerId: nativeId, games, totalBet, totalWin, totalPromoPayout});
            }

            const pagination = {
                pageSize,
                pageNumber,
                totalItems: rawSessions.length,
                totalPages: Math.ceil(rawSessions.length / pageSize),
            };

            res.json({sessions, pagination});
        });

        api.get(path + "/sessions/:sessionId/transactions", async (req: Request, res: Response) => {
            const queryString = req.originalUrl.split("?")[1] || "";
            if (req.headers["digest"] !== this.calculateChecksum(queryString + this.config.secretKey)) {
                logger.info("ALEA invalid request", {digest: req.headers["digest"], checksum: this.calculateChecksum(queryString + this.config.secretKey), queryString, secretKey: this.config.secretKey});
                res.status(500).json({status: "DENIED", code: "INVALID_REQUEST"});
                return;
            }

            const pageSize: number = parseInt(req.query.pageSize as string, 10);
            const pageNumber: number = parseInt(req.query.pageNumber as string, 10);

            const rawTransactions = await getConnection("replica")
                .manager.createQueryBuilder(Transaction, "transaction")
                .select(["transaction.id", "transaction.roundId", "transaction.createdAt", "transaction.amount", "transaction.status"])
                .leftJoin(Player, "player", "player.id = transaction.playerId")
                .leftJoin(Session, "session", "transaction.sessionId = session.sessionId")
                .andWhere("player.wallet = :wallet", {wallet})
                .andWhere("session.token = :sessionId", {sessionId: req.params.sessionId})
                .getMany();

            const transactions = [];

            for (const transaction of rawTransactions) {
                const t = {
                    transactionId: transaction.id,
                    roundId: transaction.roundId,
                    requestedAt: transaction.createdAt.toISOString().split(".")[0] + "Z",
                    amount: transaction.amount,
                };

                if (transaction.status == "cancel") {
                    transactions.push({...t, transactionType: "BET", transactionStatus: "SUCCESS", roundStatus: "IN_PROGRESS"});
                    transactions.push({...t, transactionType: "ROLLBACK", transactionStatus: "ERROR", roundStatus: "COMPLETED"});
                } else if (transaction.status == "cancelled") {
                    transactions.push({...t, transactionType: "BET", transactionStatus: "SUCCESS", roundStatus: "IN_PROGRESS"});
                    transactions.push({...t, transactionType: "ROLLBACK", transactionStatus: "ERROR", roundStatus: "COMPLETED"});
                } else {
                    const transactionType = transaction.type === "withdraw" ? "BET" : "WIN";
                    const transactionStatus = transaction.status === "finished" ? "SUCCESS" : "ERROR";
                    const roundStatus = transaction.type === "withdraw" ? "IN_PROGRESS" : "COMPLETED";
                    transactions.push({...t, transactionType, transactionStatus, roundStatus});
                }
            }

            const pagination = {
                pageSize,
                pageNumber,
                totalItems: transactions.length,
                totalPages: Math.ceil(transactions.length / pageSize),
            };

            res.json({transactions: transactions.slice(pageSize * (pageNumber - 1), pageSize * pageNumber), pagination});
        });
    }

    private async fetch<IParams, IResponse>(path: string, method: string, params: IParams, sessionId: string, nonRetriableErrorCodes: string[]): Promise<IResponse> {
        let retry = 1;
        do {
            const queryString = method === "GET" ? new URLSearchParams(params as Record<string, string>).toString() : undefined;
            const body = method === "GET" ? undefined : JSON.stringify(params);
            const headers: Record<string, string> = {};
            headers["Content-Type"] = "application/json";
            headers["AleaPlay-SessionId"] = sessionId;
            headers["Digest"] = this.calculateChecksum(sessionId + (queryString || "") + (body || "") + this.config.secretKey);
            let json;
            let text;
            let httpStatus: number = 400;
            const url = this.config.url + path + (queryString ? "?" + queryString : "");
            try {
                const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 10) * 1000});
                text = await response.text();
                json = JSON.parse(text);
                httpStatus = response.status;
            } catch (e) {
                if (retry === 0) {
                    throw new Exception("Couldn't fetch from wallet", {code: errorCodes.UNKNOWN, data: {error: e}});
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text});
            }

            if (httpStatus >= 200 && httpStatus < 300) {
                return json;
            }

            const message = json?.message || "Unknown error";
            const code: string | undefined = json?.code;

            if (code === "INSUFFICIENT_FUNDS") {
                throw new Exception(message, {code: errorCodes.INSUFFICIENT_FUNDS});
            } else if (code === "BET_DENIED") {
                throw new Exception(message, {code: errorCodes.LOSS_LIMIT});
            } else if (code === "SESSION_EXPIRED") {
                throw new Exception(message, {code: errorCodes.SESSION_EXPIRED});
            } else if (code === "TRANSACTION_NOT_FOUND") {
                throw new Exception(message, {code: errorCodes.TRANSACTION_NOT_FOUND});
            } else if (code && nonRetriableErrorCodes.includes(code)) {
                throw new Exception(message, {code: errorCodes.TRANSACTION_FAILED});
            } else if (retry === 0) {
                throw new Exception(message, {code: errorCodes.UNKNOWN});
            }
        } while (--retry >= 0);

        throw new Exception("Unexpected error");
    }

    async authenticate(key: string, operator: string, provider: string, game: string): Promise<IWalletAuthenticate> {
        let decrypted;
        try {
            decrypted = JSON.parse(this.cipher!.decrypt(key));
        } catch {
            throw new Exception("Incorrect authentication key", {data: {key, wallet: this.wallet}});
        }
        const {sessionId, timestamp} = decrypted;
        if (Date.now() - timestamp > 2 * 60 * 1000 /*2 minutes*/) {
            throw new Exception("Authentication key expired", {data: {key, wallet: this.wallet}});
        }
        const data = await this.fetch<unknown, IAuthenticateResponse>("/authenticate", "GET", {}, sessionId, ["SESSION_EXPIRED", "GAME_NOT_ALLOWED", "INVALID_REQUEST", "GENERAL_ERROR"]);

        if (operator !== data.operatorCode) throw new Exception("Operator code mismatch");
        if (data.isTest) {
            if (!(await ReportExclusion.findOneBy({wallet: this.wallet, nativeId: data.playerId}))) {
                await ReportExclusion.create({startsAt: new Date(), wallet: this.wallet, nativeId: data.playerId, comment: "created via Alea API"}).save();
            }
        }

        const token = sessionId;
        const currency = data.currency;
        const {balance} = await this.balance({nativeId: data.playerId, currency: data.currency.toLowerCase()}, provider, game, {token, data: {currency}});
        return {balance, nativeId: data.playerId, currency: data.currency.toLowerCase(), brand: data.casinoCode, country: data.country.toLowerCase(), token, sessionData: {currency}};
    }

    async balance(player: {nativeId: string; currency: string}, provider: string, game: string, session: Pick<ISession, "token" | "data">) {
        const data = await this.fetch<unknown, IBalanceResponse>(`/players/${player.nativeId}`, "GET", {currency: session.data.currency}, session.token, ["SESSION_EXPIRED", "GAME_NOT_ALLOWED", "INVALID_REQUEST", "GENERAL_ERROR"]);
        const balance = this.calculateBalance(data);

        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession) {
        if (transaction.campaignType === "freeBets") {
            const campaignPlayerDetails = await getFreeBetsPlayerDetails(transaction.campaignId!, player.id);
            if (campaignPlayerDetails?.finished) {
                const campaign = await getFreeBetsCampaignDetails(transaction.campaignId!);
                if (!campaign) throw new Exception("Couldn't find campaign name");
                const bonusId = campaign.name.replace(campaignPrefix, "");
                const params: IPromoPayoutBody = {
                    type: "PROMO_PAYOUT",
                    id: transaction.transactionId,
                    bonusId,
                    cost: round(campaign.config.amount * campaign.config.bets, 2),
                    winAmount: campaignPlayerDetails.state.totalWin,
                    currency: session.data.currency,
                    gameCode: transaction.game!,
                    round: {
                        id: transaction.roundId,
                        status: "COMPLETED",
                    },
                };
                const data = await this.fetch<IPromoPayoutBody, ITransactionResponse>(`/players/${player.nativeId}/transactions`, "POST", params, session.token, []);

                return {balance: this.calculateBalance(data)};
            } else {
                return await this.balance(player, transaction.provider!, transaction.game!, session);
            }
        } else {
            const game = transaction.game || (await Transaction.findOneOrFail({where: {playerId: transaction.playerId}, order: {createdAt: "DESC"}})).game;
            const params: ITransactionBody = {
                type: transaction.type === "withdraw" ? "BET" : "WIN",
                amount: transaction.amount,
                gameCode: game,
                currency: session.data.currency,
                id: transaction.transactionId,
                round: {
                    id: transaction.roundId,
                    status: transaction.type === "withdraw" ? "IN_PROGRESS" : "COMPLETED",
                },
            };
            const nonRetriableErrors = transaction.type === "withdraw" ? ["INSUFFICIENT_FUNDS", "BET_DENIED", "SESSION_EXPIRED", "GAME_NOT_ALLOWED", "INVALID_REQUEST"] : [];

            const data = await this.fetch<ITransactionBody, ITransactionResponse>(`/players/${player.nativeId}/transactions`, "POST", params, session.token, nonRetriableErrors);

            return {balance: this.calculateBalance(data)};
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession) {
        const params: IRollbackBody = {
            type: "ROLLBACK",
            amount: transaction.amount,
            gameCode: transaction.game!,
            currency: session.data.currency,
            betTransactionId: transaction.transactionId,
            round: {
                id: transaction.roundId,
                status: "COMPLETED",
            },
        };

        const data = await this.fetch<IRollbackBody, ITransactionResponse>(`/players/${player.nativeId}/transactions`, "POST", params, session.token, ["TRANSACTION_NOT_FOUND"]);

        return {balance: this.calculateBalance(data)};
    }

    private calculateBalance(data: {bonusBalance: number; realBalance: number}) {
        return round(data.bonusBalance + data.realBalance, 2);
    }
}

export default AleaWalletAdapter;
