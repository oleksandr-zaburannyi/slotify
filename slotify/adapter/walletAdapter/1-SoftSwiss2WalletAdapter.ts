import Exception from "@slotify/shared/lib/Exception";
import * as crypto from "crypto";
import fetch from "@slotify/shared/lib/fetch";
import {Express, NextFunction, Request, Response} from "express";
import Cipher from "@slotify/shared/lib/Cipher";
import launch from "../route/launch";
import IWalletAdapter, {ISession, IWalletTransaction} from "./IWalletAdapter";
import {errorCodes} from "./walletAdapter";
import {Game} from "../db/model/Game";
import {Player} from "../db/model/Player";
import logger from "@slotify/shared/lib/logger";
import {CurrencyAlias} from "../db/model/CurrencyAlias";
import countDecimals from "@slotify/shared/lib/countDecimals";
import {cancelCampaign, createCampaign, getAvailableBets, getCampaignByName, getFreeBetsCampaignDetails} from "../util/external";
import {round} from "@slotify/shared/lib/round";

type IDemoBody = {
    casino_id: string;
    game: string;
    locale: string;
    ip: string;
    client_type: "mobile" | "desktop";
    urls: {return_url: string};
    jurisdiction?: string;
};
type IRealBody = {
    casino_id: string;
    game: string;
    locale: string;
    ip: string;
    client_type: "mobile" | "desktop";
    urls: {return_url: string; deposit_url: string};
    jurisdiction?: string;
    session_id?: string;
    account: IAccount;
};
type IAccount = {
    country: string;
    currency: string;
    date_of_birth: string;
    firstname?: string;
    gender?: "m" | "f";
    id: string;
    lastname?: string;
    nickname: string;
    registered_at: string;
    tags?: string[];
};
type ILaunchResponse = {
    launch_url: string;
};

type IJackpotFeedBody = {
    casino_id: string;
};
type IJackpotFeedResponse = {
    games: {
        game_id: string;
        levels: {
            level: number;
            name: string;
            data: {
                amount: string;
                currency: string;
            }[];
        }[];
    }[];
};

type IFreeSpinsIssueBody = {
    account: IAccount;
    bet_level: number;
    casino_id: string;
    freespins_quantity: number;
    games: string[];
    issue_id: string;
    valid_until: string;
};

type IFreeSpinsCancelBody = {
    casino_id: string;
    issue_id: string;
};

type IBalanceParams = {
    account_id: string;
    currency: string;
    game_id: string;
};
type IBalanceResponse = {
    balance: string;
};

type IBetWinBody = {
    account_id: string;
    currency: string;
    finished?: boolean;
    game_id: string;
    round_id: string;
    session_id?: string;
    sm_result?: string;
    transactions: {
        amount: string;
        id_provider: string;
        jackpot_contribution?: string;
        jackpot_win?: string;
        type: "bet" | "win";
    }[];
};
type IBetWinResponse = {
    balance: string;
    round_id: string;
    transactions: {
        bonus_amount: string;
        id: string;
        id_provider: string;
    }[];
};

type IFinishBody = {
    account_id: string;
    currency: string;
    round_id: string;
    session_id?: string;
    sm_result?: string;
};
type IFinishResponse = {
    balance: string;
};

type IRollbackBody = {
    account_id: string;
    currency: string;
    finished: true;
    game_id: string;
    round_id_provider: string;
    session_id?: string;
    sm_result?: string;
    transactions: {
        id_provider: string;
        original_id_provider: string;
        type: "rollback";
    }[];
};
type IRollbackResponse = {
    balance: string;
    round_id: string;
    transactions: {
        id: string;
        id_provider: string;
    }[];
};

type IFreespinsBody = {
    amount: string;
    issue_id: string;
};

type IFreeSpinsResponse = {
    balance: string;
};

type IPromoWinBody = {
    account_id: string;
    amount: string;
    currency: string;
    details?: {
        wager: string;
    };
    event_id: string;
    event_type: string;
    id_provider: string;
};
type IPromoWinResponse = {
    balance: string;
    bonus_amount?: string;
    id: string;
    id_provider: string;
};

interface IConfig {
    brands: Record<string, {url: string; token: string}>;
    includeProviderInGame?: boolean;
    timeout?: number;
    convertCurrencies?: Record<string, string>;
    hostname?: string;
}

export class SoftSwiss2WalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    private cipher?: Cipher;

    private calculateChecksum(body: string, secretKey: string) {
        return crypto.createHmac("sha256", secretKey).update(body).digest("hex");
    }

    private getBrandConfig(casinoId: string) {
        const brand = this.config.brands[casinoId];
        if (!brand) throw new Exception("SoftSwiss brand (casino_id) not defined");
        return brand;
    }

    private validateServer(req: Request, res: Response, next: NextFunction) {
        if (req.headers["x-request-sign"] === this.calculateChecksum((req as any).rawBody, this.getBrandConfig(req.body.casino_id).token)) {
            return next();
        }

        res.status(403).json({code: "permission_denied", msg: "Couldn't authorize the server"});
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;

        this.cipher = new Cipher(Object.values(this.config.brands || {})[0]?.token || this.wallet, this.wallet);

        api.post(path + "/v2/a8r_provider.Launcher/Demo", this.validateServer.bind(this), async (req: Request<unknown, unknown, IDemoBody>, res: Response) => {
            const game = Game.removeProviderPrefix(config, req.body.game);
            const language = req.body.locale;
            const lobbyUrl = req.body.urls.return_url;
            const operator = "softswiss";

            const launchUrl = await launch("fun", {lobbyUrl, language, game, operator, hostname: config.hostname}, req);
            const response: ILaunchResponse = {launch_url: launchUrl};
            res.json(response);
        });

        api.post(path + "/v2/a8r_provider.Launcher/Real", this.validateServer.bind(this), async (req: Request<unknown, unknown, IRealBody>, res: Response) => {
            const operator = "softswiss";
            const brand = req.body.casino_id;
            const currency = this.currencyFromSoftSwiss(req.body.account.currency);
            const game = Game.removeProviderPrefix(config, req.body.game);
            const language = req.body.locale;
            const lobbyUrl = req.body.urls.return_url;
            const depositUrl = req.body.urls.deposit_url;
            const jurisdiction = req.body.jurisdiction?.toLowerCase();
            const nativeId = this.nativeIdFromSoftSwiss(req.body.account.id, currency);
            const nickname = req.body.account.nickname;
            const country = req.body.account.country?.toLowerCase();
            const gender = req.body.account.gender;
            const sessionId = req.body.session_id;
            const key = this.cipher!.encrypt(JSON.stringify({nativeId, currency, brand, jurisdiction, country, nickname, gender, timestamp: Date.now(), sessionId}));

            const launchUrl = await launch("real", {wallet, operator, lobbyUrl, language, game, depositUrl, key, hostname: config.hostname}, req);
            const response: ILaunchResponse = {launch_url: launchUrl};
            res.json(response);
        });

        api.post(path + "/v2/a8r_provider.Jackpot/Feed", this.validateServer.bind(this), async (req: Request<unknown, unknown, IJackpotFeedBody>, res: Response) => {
            const response: IJackpotFeedResponse = {games: []};
            res.json(response);
        });

        api.post(path + "/v2/a8r_provider.Freespins/Issue", this.validateServer.bind(this), async (req: Request<unknown, unknown, IFreeSpinsIssueBody>, res: Response) => {
            const wallets = [wallet];
            const operator = "softswiss";
            const brand = req.body.casino_id;
            const name = "softswiss2-api_" + req.body.issue_id;
            const currency = this.currencyFromSoftSwiss(req.body.account.currency);
            const game = Game.removeProviderPrefix(config, req.body.games[0]);
            if (req.body.games.length > 1) {
                throw new Exception("Can't create campaign for multiple games");
            }
            const {provider} = await Game.get(game);
            const bets = req.body.freespins_quantity;
            const betLevels = await getAvailableBets({wallet, operator, brand, provider, game, currency});
            if (req.body.bet_level === undefined || req.body.bet_level > betLevels.length) {
                throw new Exception("Couldn't find bet level", {data: {betLevels, level: req.body.bet_level}});
            }
            const amount = betLevels[req.body.bet_level - 1];
            const end = new Date(req.body.valid_until).getTime();
            const nativeIds = [this.nativeIdFromSoftSwiss(req.body.account.id, currency)];

            try {
                if (await getCampaignByName(name)) {
                    throw new Exception(`Campaign named ${name} already exists`);
                }
                const data = {type: "freeBets", name, end, wallets, providers: [provider], games: [game], nativeIds, config: {bets, amount, currency}};
                await createCampaign(data);
                res.json({}); //Response body is empty body when freespins were issued successfully
            } catch (e) {
                if (e instanceof Exception) {
                    res.status(400).json({code: "unknown", msg: e.message});
                    return;
                }
                throw e;
            }
        });

        api.post(path + "/v2/a8r_provider.Freespins/Cancel", this.validateServer.bind(this), async (req: Request<unknown, unknown, IFreeSpinsCancelBody>, res: Response) => {
            const name = "softswiss2-api_" + req.body.issue_id;

            try {
                const campaign = await getCampaignByName(name);
                if (!campaign) throw new Exception(`Couldn't find campaign named ${name}`);

                await cancelCampaign(campaign.campaignId);
                res.json({}); //Response body is empty body when freespins were canceled successfully
            } catch (e) {
                if (e instanceof Exception) {
                    res.status(400).json({code: "unknown", msg: e.message});
                    return;
                }
                throw e;
            }
        });
    }

    private async fetch<IParams, IResponse>(path: string, method: string, params: IParams, casinoId: string): Promise<IResponse> {
        let retry = 1;
        do {
            const body = JSON.stringify(params);
            const headers: Record<string, string> = {};
            headers["Content-Type"] = "application/json";
            const brand = this.getBrandConfig(casinoId);
            headers["x-request-sign"] = this.calculateChecksum(body, brand.token);
            let json;
            let text;
            let httpStatus: number = 400;
            const url = `${brand.url}${path}`;
            try {
                const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
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
            if (httpStatus <= 400 && json && !json.code && !json.meta) {
                return json;
            }
            const message = json?.msg || "Unknown error";
            const code: string | undefined = json?.meta?.api_code;
            if (httpStatus >= 500) {
                throw new Exception(message, {code: errorCodes.UNKNOWN});
            }

            if (code === "100") {
                throw new Exception(message, {code: errorCodes.INSUFFICIENT_FUNDS});
            } else if (code === "105" || code === "106") {
                throw new Exception(message, {code: errorCodes.LOSS_LIMIT});
            } else if (retry === 0) {
                throw new Exception(message, {code: errorCodes.TRANSACTION_FAILED});
            }
        } while (--retry >= 0);
        throw new Exception("Unexpected error");
    }

    async authenticate(key: string, operator: string, provider: string, game: string) {
        let decrypted;
        try {
            decrypted = JSON.parse(this.cipher!.decrypt(key));
        } catch {
            throw new Exception("Incorrect authentication key", {data: {key, wallet: this.wallet}});
        }
        const {nativeId, currency, brand, jurisdiction, country, nickname, gender, timestamp, sessionId} = decrypted;
        if (Date.now() - timestamp > 60 * 1000 /*1 minutes*/) {
            throw new Exception("Authentication key expired", {data: {key, nativeId, wallet: this.wallet}});
        }

        const token = key;
        const params = {account_id: this.nativeIdToSoftSwiss(nativeId), currency: this.currencyToSoftSwiss(currency), game_id: Game.addProviderPrefix(this.config, provider, game)};
        const data = await this.fetch<IBalanceParams, IBalanceResponse>("/v2/provider_a8r.Player/Balance", "POST", params, brand);

        return {nativeId, token, currency, balance: await this.amountFromSoftSwiss(data.balance, currency), country, brand, nickname, gender, jurisdiction, sessionData: {sessionId}};
    }

    async balance(player: Player, provider: string, game: string) {
        const {currency, nativeId} = player;
        const params = {account_id: this.nativeIdToSoftSwiss(nativeId), currency: this.currencyToSoftSwiss(currency), game_id: Game.addProviderPrefix(this.config, provider, game)};
        const data = await this.fetch<IBalanceParams, IBalanceResponse>("/v2/provider_a8r.Player/Balance", "POST", params, player.brand!);
        const {balance} = data;

        return {balance: await this.amountFromSoftSwiss(balance, currency)};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession) {
        const {currency, nativeId} = player;

        const eventTypes: Record<string, string> = {prizeDrop: "Prize Drop", tournament: "Tournament"};
        if (transaction.category === "promo") {
            const params: IPromoWinBody = {
                account_id: this.nativeIdToSoftSwiss(nativeId),
                currency: this.currencyToSoftSwiss(currency),
                amount: await this.amountToSoftSwiss(transaction.amount, currency),
                id_provider: transaction.transactionId,
                event_id: transaction.campaignId!,
                event_type: eventTypes[transaction.campaignType!],
            };

            const data = await this.fetch<IPromoWinBody, IPromoWinResponse>("/v2/provider_a8r.Promo/Win", "POST", params, player.brand!);
            if (typeof data.balance !== "string") throw new Exception("Incorrect balance returned", {data: {data, nativeId}});
            if (data.id_provider !== params.id_provider) throw new Exception("Incorrect id_provider returned", {data: {data, nativeId}});

            return {balance: await this.amountFromSoftSwiss(data.balance, currency)};
        } else if (transaction.campaignType === "freeBets") {
            if (transaction.type === "deposit" && transaction.campaignData!.used === transaction.campaignData?.total) {
                const campaign = await getFreeBetsCampaignDetails(transaction.campaignId!);
                if (!campaign) throw new Exception("Couldn't find campaign name");
                const issueId = campaign.name.replace("softswiss2-api_", "");
                const params: IFreespinsBody = {
                    issue_id: issueId,
                    amount: await this.amountToSoftSwiss(transaction.campaignData!.totalWin, currency),
                };
                const data = await this.fetch<IFreespinsBody, IFreeSpinsResponse>("/v2/provider_a8r.Freespins/Finish", "POST", params, player.brand!);
                if (typeof data.balance !== "string") throw new Exception("Incorrect balance returned", {data: {data, nativeId}});

                return {balance: await this.amountFromSoftSwiss(data.balance, currency)};
            } else {
                return this.balance(player, transaction.provider!, transaction.game!);
            }
        } else {
            if (transaction.type !== "deposit" || transaction.amount !== 0) {
                const params: IBetWinBody = {
                    account_id: this.nativeIdToSoftSwiss(nativeId),
                    currency: this.currencyToSoftSwiss(currency),
                    game_id: Game.addProviderPrefix(this.config, transaction.provider!, transaction.game!),
                    finished: transaction.roundFinished,
                    round_id: transaction.roundId,
                    session_id: session.data.sessionId,
                    sm_result: transaction.regulatory?.pt?.sm_result,
                    transactions: [
                        {
                            type: transaction.type === "withdraw" ? "bet" : "win",
                            amount: await this.amountToSoftSwiss(transaction.amount, currency),
                            id_provider: transaction.transactionId,
                            jackpot_contribution: transaction.type === "withdraw" && transaction.jackpotAmount ? await this.amountToSoftSwiss(transaction.jackpotAmount, currency) : undefined,
                            jackpot_win: transaction.type === "deposit" && transaction.jackpotAmount ? await this.amountToSoftSwiss(transaction.jackpotAmount, currency) : undefined,
                        },
                    ],
                };

                const data = await this.fetch<IBetWinBody, IBetWinResponse>("/v2/provider_a8r.Round/BetWin", "POST", params, player.brand!);
                if (typeof data.balance !== "string") throw new Exception("Incorrect balance returned", {data: {data, nativeId, transaction}});
                if (data.round_id !== params.round_id) throw new Exception("Incorrect round_id returned", {data: {data, nativeId, transaction}});
                if (data.transactions?.length !== params.transactions.length) throw new Exception("Incorrect transactions returned", {data: {data, nativeId, transaction}});
                if (!data.transactions.every((t, i) => t.id_provider === params.transactions[i].id_provider)) throw new Exception("Incorrect transactions returned", {data: {data, nativeId, transaction}});

                return {balance: await this.amountFromSoftSwiss(data.balance, currency)};
            } else {
                const params: IFinishBody = {
                    account_id: this.nativeIdToSoftSwiss(nativeId),
                    currency: this.currencyToSoftSwiss(currency),
                    round_id: transaction.roundId,
                    session_id: session.data.sessionId,
                    sm_result: transaction.regulatory?.pt?.sm_result,
                };
                const data = await this.fetch<IFinishBody, IFinishResponse>("/v2/provider_a8r.Round/Finish", "POST", params, player.brand!);
                if (typeof data.balance !== "string") throw new Exception("Incorrect balance returned", {data: {data, nativeId, transaction}});

                return {balance: await this.amountFromSoftSwiss(data.balance, currency)};
            }
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession) {
        const {currency, nativeId} = player;
        if (transaction.campaignType === "freeBets") {
            return this.balance(player, transaction.provider!, transaction.game!);
        }
        const params: IRollbackBody = {
            account_id: this.nativeIdToSoftSwiss(nativeId),
            currency: this.currencyToSoftSwiss(currency),
            game_id: Game.addProviderPrefix(this.config, transaction.provider!, transaction.game!),
            round_id_provider: transaction.roundId,
            session_id: session.data.sessionId,
            sm_result: transaction.regulatory?.pt?.sm_result,
            finished: true,
            transactions: [
                {
                    type: "rollback",
                    id_provider: "rollback_" + transaction.transactionId,
                    original_id_provider: transaction.transactionId,
                },
            ],
        };
        const data = await this.fetch<IRollbackBody, IRollbackResponse>("/v2/provider_a8r.Round/Rollback", "POST", params, player.brand!);

        if (typeof data.balance !== "string") throw new Exception("Incorrect balance returned", {data: {data, nativeId, transaction}});
        if (data.transactions?.length !== params.transactions.length) throw new Exception("Incorrect transactions returned", {data: {data, nativeId, transaction}});
        if (!data.transactions.every((t, i) => t.id_provider === params.transactions[i].id_provider)) throw new Exception("Incorrect transactions returned", {data: {data, nativeId, transaction}});

        return {balance: await this.amountFromSoftSwiss(data.balance, currency)};
    }

    private async amountFromSoftSwiss(amount: string, currency: string): Promise<number> {
        const multiplier = await this.getCurrencyMultiplier(currency);
        const decimals = Math.max(0, countDecimals(parseFloat(amount)) - countDecimals(multiplier));
        return round(parseFloat(amount) / multiplier, decimals);
    }

    private async amountToSoftSwiss(amount: number, currency: string): Promise<string> {
        const multiplier = await this.getCurrencyMultiplier(currency);
        const decimals = countDecimals(amount) + countDecimals(multiplier);
        return round(amount * multiplier, decimals).toFixed(decimals);
    }

    private async getCurrencyMultiplier(currency: string) {
        if (Object.values(this.config.convertCurrencies || {}).includes(currency)) {
            const alias = (await CurrencyAlias.getAll()).find(({alias}) => alias === currency);
            if (!alias) {
                throw new Exception(`Alias not available for currency ${currency}`);
            }
            return alias.multiplier;
        }
        return 1;
    }

    private currencyToSoftSwiss(currency: string) {
        for (const key in this.config.convertCurrencies || {}) {
            if ((this.config.convertCurrencies || {})[key] === currency) return key.toUpperCase();
        }
        return currency.toUpperCase();
    }

    private currencyFromSoftSwiss(currency: string) {
        return (this.config.convertCurrencies || {})[currency.toLowerCase()] || currency.toLowerCase();
    }

    private nativeIdToSoftSwiss(nativeId: string) {
        return nativeId.substring(0, nativeId.lastIndexOf("_"));
    }

    private nativeIdFromSoftSwiss(nativeId: string, currency: string) {
        return nativeId + "_" + currency;
    }
}

export default SoftSwiss2WalletAdapter;
