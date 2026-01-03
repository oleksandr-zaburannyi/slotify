import Exception from "@slotify/shared/lib/Exception";
import * as crypto from "crypto";
import fetch from "@slotify/shared/lib/fetch";
import {Player} from "../db/model/Player";
import IWalletAdapter, {IWalletTransaction} from "./IWalletAdapter";
import {Express, NextFunction, Request, Response} from "express";
import {round} from "@slotify/shared/lib/round";
import {readFileSync} from "fs";
import * as xml2js from "xml2js";
import {DateTime} from "../util/luxon";
import {gql} from "graphql-request";
import {CurrencyAlias} from "../db/model/CurrencyAlias";
import logger from "@slotify/shared/lib/logger";
import Cipher from "@slotify/shared/lib/Cipher";
import launch from "../route/launch";
import {Game} from "../db/model/Game";
import {getAvailableBets, getFreeBetsCampaignDetails} from "../util/external";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {errorCodes} from "./walletAdapter";

type IUser = {id: string; external_id: string; email?: string; firstname: string; lastname: string; nickname: string; city: string; date_of_birth: string; registered_at: string; gender: "m" | "f"; country: string};
type IDemoBody = {casino_id: string; game: string; locale: string; ip: string; client_type: "mobile" | "desktop"; urls: {return_url: string; deposit_url: string}; jurisdiction?: string};
type ISessionsBody = {currency: string; balance?: number; user: IUser; payload?: any} & IDemoBody;
type ILaunchResponse = {launch_options: {game_url: string; strategy: "detect" | "iframe" | "redirect"}};

type IFreeSpinsCancelBody = {casino_id: string; issue_id: string};
type IFreeSpinsIssueBody = {casino_id: string; issue_id: string; currency: string; games: string[]; freespins_quantity: number; bet_level?: number; valid_until: string; user: IUser};

type IFreespinsParams = {issue_id: string; status: "active" | "expired" | "played"; total_amount: number};
type IFreespinsResponse = {balance: number};

type IBalanceParams = {user_id: string; currency: string; game: string; game_id?: string; finished?: boolean};
type IBalanceResponse = {balance: number};

type IPlayAction = {action: "bet" | "win"; amount: number; action_id: string; jackpot_contribution?: number; jackpot_win?: number};
type IPlayParams = {user_id: string; currency: string; game: string; game_id: string; finished: boolean; actions?: IPlayAction[]};
type IPlayResponse = {balance: number; game_id: string; transactions: {action_id: string; tx_id: string}[]};

type IRollbackAction = {action: string; action_id: string; original_action_id: string};
type IRollbackParams = {user_id: string; currency: string; game: string; game_id: string; finished?: boolean; actions: IRollbackAction[]};
type IRollbackResponse = {balance: number; game_id?: string; transactions: {action_id: string; tx_id: string}[]};

interface IConfig {
    url: string;
    secretKey: string;
    includeProviderInGame?: boolean;
    timeout?: number;
}

const forceConversion: Record<string, string> = {
    btc: "ubtc",
    eth: "meth",
    bnb: "mbnb",
    ltc: "mltc",
};

export class SoftSwissWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    private ratios: Record<string, number> = {};
    private cipher?: Cipher;

    private validateServer(req: Request, res: Response, next: NextFunction) {
        const checksum = crypto
            .createHmac("sha256", this.config.secretKey)
            .update((req as any).rawBody)
            .digest("hex");
        if (req.headers["x-request-sign"] === checksum) {
            return next();
        }

        res.status(403).json({code: errorCodes.SERVER_UNAUTHORIZED, message: "Couldn't authorize the server"});
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;

        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        await this.initRatios();

        api.post(path + "/demo", this.validateServer.bind(this), async (req: Request<unknown, unknown, IDemoBody>, res: Response) => {
            const game = Game.removeProviderPrefix(config, req.body.game);
            const language = req.body.locale;
            const lobbyUrl = req.body.urls.return_url;
            const operator = "softswiss";

            const launchUrl = await launch("fun", {lobbyUrl, language, game, operator}, req);
            const response: ILaunchResponse = {launch_options: {game_url: launchUrl, strategy: "detect"}};
            res.json(response);
        });

        api.post(path + "/sessions", this.validateServer.bind(this), async (req: Request<unknown, unknown, ISessionsBody>, res: Response) => {
            const operator = "softswiss";
            const brand = req.body.casino_id;
            const currency = req.body.currency.toLowerCase();
            const game = Game.removeProviderPrefix(config, req.body.game);
            const language = req.body.locale;
            const lobbyUrl = req.body.urls.return_url;
            const depositUrl = req.body.urls.deposit_url;
            const jurisdiction = req.body.jurisdiction?.toLowerCase();
            const nativeId = req.body.user.id;
            const nickname = req.body.user.nickname;
            const country = req.body.user.country?.toLowerCase();
            const gender = req.body.user.gender;
            const key = this.cipher!.encrypt(JSON.stringify({nativeId, currency: this.convertCurrencyFrom(currency), brand, jurisdiction, country, nickname, gender, timestamp: Date.now()}));

            const launchUrl = await launch("real", {wallet, operator, lobbyUrl, language, game, depositUrl, key}, req);
            const response: ILaunchResponse = {launch_options: {game_url: launchUrl, strategy: "detect"}};
            res.json(response);
        });

        api.post(path + "/freespins/issue", this.validateServer.bind(this), async (req: Request<unknown, unknown, IFreeSpinsIssueBody>, res: Response) => {
            const wallets = [wallet];
            const operator = "softswiss";
            const brand = req.body.casino_id;
            const name = "softswiss-api_" + req.body.issue_id;
            const currency = process.env.BASE_CURRENCY;
            const game = Game.removeProviderPrefix(config, req.body.games[0]);
            if (req.body.games.length > 1) {
                throw new Exception("Can't create campaign for multiple games");
            }
            const {provider} = await Game.get(game);
            const bets = req.body.freespins_quantity;
            const betLevels = await getAvailableBets({wallet, operator, brand, provider, game, currency: process.env.BASE_CURRENCY!});
            if (req.body.bet_level === undefined || req.body.bet_level > betLevels.length) {
                throw new Exception("Couldn't find bet level", {data: {betLevels, level: req.body.bet_level}});
            }
            const amount = betLevels[req.body.bet_level - 1];
            const end = DateTime.fromISO(req.body.valid_until).toMillis();
            const nativeIds = [req.body.user.id];

            const variables = {data: {type: "freeBets", name, end, wallets, providers: [provider], games: [game], nativeIds, config: {bets, amount, currency}}};

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
                    throw new Exception("Error creating free bets campaign");
                }

                res.send(); //Response body is empty when freespins were issued successfully
            } catch (e) {
                if (e instanceof Exception) {
                    res.status(400).json({code: e.code, message: e.message});
                    return;
                }
                throw e;
            }
        });

        api.post(path + "/freespins/cancel", this.validateServer.bind(this), async (req: Request<unknown, unknown, IFreeSpinsCancelBody>, res: Response) => {
            const name = "softswiss-api_" + req.body.issue_id;

            try {
                const campaignId = await this.getCampaignByName(name);
                if (!campaignId) throw new Exception(`Couldn't find campaign named ${name}`);

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

                res.send(); //Response body is empty when freespins were canceled successfully
            } catch (e) {
                if (e instanceof Exception) {
                    res.status(400).json({code: e.code, message: e.message});
                    return;
                }
                throw e;
            }
        });
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

    private async fetch<IParams, IResponse>(path: string, method: string, params: IParams): Promise<IResponse> {
        let retry = 1;
        do {
            const body = params ? JSON.stringify(params) : undefined;
            const headers: Record<string, string> = {};
            headers["Content-Type"] = "application/json";
            headers["x-request-sign"] = crypto
                .createHmac("sha256", this.config.secretKey)
                .update(body ? body : "")
                .digest("hex");
            let json;
            let text;
            const url = `${this.config.url}${path}`;
            try {
                const response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 15) * 1000});
                text = await response.text();
                json = JSON.parse(text);
            } catch (e) {
                if (retry === 0) {
                    throw new Exception("Couldn't fetch from wallet", {code: "NETWORK_ERROR", data: {error: e}});
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text});
            }
            if (json?.code) {
                if (json.code === 100) {
                    throw new Exception(json.message, {code: errorCodes.INSUFFICIENT_FUNDS});
                } else if (json.code === 105 || json.code === 106) {
                    throw new Exception(json.message, {code: errorCodes.LOSS_LIMIT});
                } else if (retry === 0) {
                    throw new Exception(json.message, {code: "UNKNOWN_ERROR"});
                }
            } else if (json) {
                return json;
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
        const {nativeId, currency, brand, jurisdiction, country, nickname, gender, timestamp} = decrypted;
        if (Date.now() - timestamp > 5 * 60 * 1000 /*5 minutes*/) {
            throw new Exception("Authentication key expired", {data: {key, nativeId, wallet: this.wallet}});
        }

        const token = key;
        const params = {user_id: nativeId, currency: this.convertCurrencyTo(currency), game: Game.addProviderPrefix(this.config, provider, game)};
        const data = await this.fetch<IBalanceParams, IBalanceResponse>("/play", "POST", params);
        const {balance} = data;
        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});

        return {nativeId, token, currency, balance: await this.convertAmountTo(balance, currency), country, brand, nickname, gender, jurisdiction};
    }

    async balance(player: Player, provider: string, game: string) {
        const {currency, nativeId} = player;
        const params = {user_id: nativeId, currency: this.convertCurrencyTo(currency), game: Game.addProviderPrefix(this.config, provider, game)};
        const data = await this.fetch<IBalanceParams, IBalanceResponse>("/play", "POST", params);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});

        return {balance: await this.convertAmountTo(balance, currency)};
    }

    async transaction(player: Player, transaction: IWalletTransaction) {
        const {currency, nativeId} = player;
        if (transaction.campaignType === "freeBets") {
            if (transaction.campaignData!.used === transaction.campaignData?.total) {
                const campaign = await getFreeBetsCampaignDetails(transaction.campaignId!);
                if (!campaign) throw new Exception("Couldn't find campaign name");
                const issueId = campaign.name.replace("softswiss-api_", "");
                const params: IFreespinsParams = {
                    issue_id: issueId,
                    status: "played",
                    total_amount: await this.convertAmountFrom(transaction.campaignData.totalWin, currency),
                };
                const data = await this.fetch<IFreespinsParams, IFreespinsResponse>("/freespins", "POST", params);
                const {balance} = data;
                if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});

                return {balance: await this.convertAmountTo(balance, currency)};
            } else {
                return this.balance(player, transaction.provider!, transaction.game!);
            }
        } else {
            const params: IPlayParams = {
                user_id: nativeId,
                currency: this.convertCurrencyTo(currency),
                game: Game.addProviderPrefix(this.config, transaction.provider!, transaction.game!),
                game_id: transaction.roundId,
                finished: transaction.roundFinished,
            };

            if (transaction.type !== "deposit" || transaction.amount !== 0) {
                const action: IPlayAction = {
                    action: transaction.type === "withdraw" ? "bet" : "win",
                    amount: await this.convertAmountFrom(transaction.amount, currency),
                    action_id: transaction.transactionId,
                };
                if (transaction.type === "withdraw" && transaction.jackpotAmount) {
                    action.jackpot_contribution = await this.convertAmountFrom(transaction.jackpotAmount, currency);
                }
                if (transaction.type === "deposit" && transaction.jackpotAmount) {
                    action.jackpot_win = await this.convertAmountFrom(transaction.jackpotAmount, currency);
                }

                params.actions = [action];
            }
            const data = await this.fetch<IPlayParams, IPlayResponse>("/play", "POST", params);
            const {balance, transactions, game_id} = data;
            if (transactions?.length !== params.actions?.length) throw new Exception("Transaction not processed correctly by SoftSwiss", {data: {data, balance, nativeId, transaction, params, transactions}});
            if (params.actions && !params.actions.every(action => transactions.find(t => t.action_id === action.action_id)))
                throw new Exception("Action has no corresponding transaction", {data: {data, balance, nativeId, transaction, params, transactions}});
            if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});
            if (params.actions && typeof game_id !== "string") throw new Exception("Incorrect game_id returned", {data: {data, balance, nativeId, transaction}});

            return {balance: await this.convertAmountTo(balance, currency)};
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction) {
        const {currency, nativeId} = player;
        const params: IRollbackParams = {
            user_id: nativeId,
            currency: this.convertCurrencyTo(currency),
            game: Game.addProviderPrefix(this.config, transaction.provider!, transaction.game!),
            game_id: transaction.roundId,
            actions: [
                {
                    action: "rollback",
                    action_id: "rollback_" + transaction.transactionId,
                    original_action_id: transaction.transactionId,
                },
            ],
        };
        const data = await this.fetch<IRollbackParams, IRollbackResponse>("/rollback", "POST", params);
        const {balance, transactions} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId, transaction}});
        if (params.actions && !params.actions?.every(action => transactions.find(t => t.action_id === action.action_id)))
            throw new Exception("Action has no corresponding transaction", {data: {data, balance, nativeId, params, transactions}});

        return {balance: await this.convertAmountTo(balance, currency)};
    }

    private async initRatios() {
        const ratios: Record<string, number> = {};
        const cryptoCurrencies = readFileSync(__dirname + "/softswiss/crypto.xml").toString();
        const fiatCurrencies = readFileSync(__dirname + "/softswiss/fiat.xml").toString();

        for (const item of (await xml2js.parseStringPromise(cryptoCurrencies))["Non-ISO_4217"].CcyTbl) {
            ratios[item.CcyNtry[0].Ccy[0].toLowerCase()] = parseInt(item.CcyNtry[0].CcyMnrUnts, 10);
        }
        for (const item of (await xml2js.parseStringPromise(fiatCurrencies))["ISO_4217"].CcyTbl[0].CcyNtry) {
            if (item.Ccy && !isNaN(parseInt(item.CcyMnrUnts[0], 10))) {
                ratios[item.Ccy[0].toLowerCase()] = parseInt(item.CcyMnrUnts[0], 10);
            }
        }
        this.ratios = ratios;
    }

    private async convertAmountTo(amount: number, currency: string): Promise<number> {
        const {power, ratio} = await this.getCurrencyRatio(currency);
        return round(amount / Math.pow(10, power) / ratio, 2);
    }

    private async convertAmountFrom(amount: number, currency: string): Promise<number> {
        const {power, ratio} = await this.getCurrencyRatio(currency);
        return round(amount * Math.pow(10, power) * ratio, 0);
    }

    //convert currency to SS format
    private convertCurrencyTo(currency: string) {
        for (const c in forceConversion) {
            if (forceConversion[c] === currency) return c.toUpperCase();
        }
        return currency.toUpperCase();
    }

    //convert currency from SS format
    private convertCurrencyFrom(currency: string) {
        return forceConversion[currency.toLowerCase()] || currency.toLowerCase();
    }

    private async getCurrencyRatio(currency: string): Promise<{power: number; ratio: number}> {
        let ratio = 1;
        const alias = Object.values(forceConversion).includes(currency) && (await CurrencyAlias.findOneBy({alias: currency}));
        if (alias) {
            ratio = alias.multiplier;
            currency = alias.currency;
        }

        if (this.ratios[currency] === undefined) throw new Exception("Couldn't find currency ratio", {data: {currency}});
        return {power: this.ratios[currency], ratio};
    }
}

export default SoftSwissWalletAdapter;
