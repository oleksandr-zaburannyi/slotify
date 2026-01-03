import * as crypto from "crypto";
import IWalletAdapter, {ISession, IWalletTransaction} from "./IWalletAdapter";
import {Express, Request, Response} from "express";
import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import Cipher from "@slotify/shared/lib/Cipher";
import logger from "@slotify/shared/lib/logger";
import fetch from "@slotify/shared/lib/fetch";
import {Player} from "../db/model/Player";
import {Transaction} from "../db/model/Transaction";
import {StatusCode} from "@slotify/shared/lib/StatusCode";
import {gql} from "graphql-request";
import currencies from "../route/currencies";
import {Game} from "../db/model/Game";
import launch from "../route/launch";
import {Session} from "../db/model/Session";
import {errorCodes} from "./walletAdapter";
import {cancelCampaign, createCampaign, editCampaign, getCampaignByName, getCriticalFiles, getFreeBetsCampaignDetails} from "../util/external";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import proxy from "../route/proxy";

type ILaunchFun = {
    providergameid: string;
    licenseeid: number;
    operator?: string;
    currency: string;
    isbskinid: number;
    isbgameid: number;
    mode: "fun";
    language: string;
    lobbyurl?: string;
    extra?: string;
    jurisdiction: string;
};

type ILunchReal = {
    providergameid: string;
    licenseeid: number;
    operator?: string;
    playerid: string;
    token: string;
    username: string;
    currency: string;
    country: string;
    registration_country?: string;
    isbskinid: number;
    isbgameid: number;
    mode: "real";
    launchercode: string;
    language: string;
    rci?: number;
    historyurl?: string;
    lobbyurl?: string;
    extra?: string;
    promotionurl?: string;
    auto_enabled?: boolean;
    turbo_mode?: boolean;
    allow_full_screen?: boolean;
    jurisdiction: string;
};
type IStandardRequest = {
    providergameid: string;
    licenseeid: number;
    operator?: string;
    token?: string;
    sessionid?: string;
    playerid: string;
    username: string;
    currency: string;
    country: string;
    ISBskinid: number;
    ISBgameid: number;
    extra?: string;
};
type IRequest<IParams> = IStandardRequest & {
    state: "single";
    action: {command: "initsession" | "balance" | "bet" | "win" | "depositmoney" | "cancel" | "end"; parameters?: IParams};
};
type IResponse<T> = T &
    ({status: "success"} | {status: "error"; code: string; message: string; action: "void" | "continue" | "buttons"; display?: boolean; buttons?: {text: string; action: "void" | "continue" | "history"; retry?: boolean}[]});
type IRestrictedFunds = {cash_balance: number; bonus_balance: number; fund_order: "CASH_FIRST"};
type IMessage = unknown;
type IBalanceRequest = IRequest<undefined>;
type IBalanceResponse = IResponse<{balance: number; currency: string; restricted_funds?: IRestrictedFunds}>;

type IInitSessionRequest = IRequest<undefined>;
type IInitSessionResponse = IResponse<{sessionid: string; playerid: string; username: string; currency: string; balance: number; restricted_funds?: IRestrictedFunds}>;

type IBetRequest = IRequest<{
    transactionid: string;
    roundid: string;
    amount: number;
    jpc?: number;
    freeroundid?: number;
    timestamp?: number;
    additional_game_values?: {ticketid?: string; jackpot?: {id: number; name: string; type: "global" | "local"; jpc: number}[]};
}>;
type IBetResponse = IResponse<{balance: number; currency: string; restricted_funds?: IRestrictedFunds; message: IMessage}>;

type IWinRequest = IRequest<{
    transactionid: string;
    roundid: string;
    closeround: boolean;
    amount: number;
    freeroundid?: number;
    lastfreeround?: boolean;
    jpw?: number;
    jpw_from_jpc?: number;
    jpw_details?: {jp_id: string; jp_amount_before_win: number; jp_amount_after_win: number};
    additional_game_values?: {ticketid?: string; jackpot?: {id: number; name: string; type: "global" | "local"}[]};
}>;
type IWinResponse = IResponse<{balance: number; currency: string; restricted_funds?: IRestrictedFunds; message: IMessage; Bonusinfo?: {bonusamount: number; bonusstatus: "pending" | "queued" | "active"}}>;

type IDepositMoneyRequest = IRequest<{transactionid: string; amount: number; offerid: string; type: string; description?: string; timestamp?: number; additional_game_values?: Record<string, string>}>;
type IDepositMoneyResponse = IResponse<{balance: number; currency: string; restricted_funds?: IRestrictedFunds}>;

type ICancelRequest = IRequest<{transactionid: string; roundid: string; amount: number; freeroundid?: number; timestamp?: number}>;
type ICancelResponse = IResponse<{balance: number; currency: string; restricted_funds?: IRestrictedFunds}>;

type IKeyData = [IStandardRequest, {jurisdiction: string}];

type IPlayerRoundHistory = {command: "player_round_history"; licensee: number; operator?: string; roundid: string; ISBskinid: number; providergameid: string; playerid?: string; sessionid: string; hash: string; language?: string};
type IGetCoinValues = {command: "get_coin_values"; providergameids: string[]};
type ICoinValues = Record<string, Record<string, {default_coin: number; coins: number[]}>>;
type IGetCriticalFiles = {command: "get_critical_files"; providergameids: string[]};
type ICriticalFile = {market: string; market_files: {providergameid: string; name: string; type: string; hash: string}[]};
type IForceCloseRounds = {command: "force_close_rounds"; rounds: {roundid: string; ISBskinid: number; providergameid: string; licensee?: number}[]};

type IEndRequest = IRequest<{sessionstatus: "CLOSE" | "ERROR"; jppool?: {id: number; value: number; currency: string; coin_value: number}}>;
type IEndResponse = IResponse<{balance: number; currency: string; restricted_funds?: IRestrictedFunds}>;

type IFreeRoundsRequest<T> = {auth: {signature: string}; request: T};
type IFreeRoundsCreateRequest = IFreeRoundsRequest<{
    start_date?: string;
    end_date?: string;
    freeround_id: number;
    licensee_id: number;
    operator: string;
    limit_per_player: number;
    games_id: Record<string, {coin_value: number; currency: string}[]>;
    launchercode?: string;
}>;
type IFreeRoundsCancelRequest = IFreeRoundsRequest<{freeround_id: number; licensee_id: number; operator: string; launchercode?: string}>;
type IFreeRoundsPlayerRegister = IFreeRoundsRequest<{freeround_id: number; licensee_id: number; operator: string; launchercode?: string; player_ids: string[]}>;
type IFreeRoundsPlayerRemove = IFreeRoundsRequest<{freeround_id: number; licensee_id: number; operator: string; launchercode?: string; player_ids: string[]}>;
type IFreeRoundsResponse = {success: boolean; error?: string; message?: string};

interface IConfig {
    url: string;
    secretKey: string;
}

const moneyFromISoftBet = (number: number) => {
    return number / 100;
};
const moneyToISoftBet = (number: number) => {
    return Math.round(number * 100);
};
const idToCampaignName = (id: number) => {
    return "isoftbet_" + id;
};
const idFromCampaignName = (name: string) => {
    return parseInt(name.replace("isoftbet_", ""), 10);
};
const toNativeId = (licensee: number, id: string) => {
    return licensee + "_" + id;
};

const freeRoundsEmptyPlayer = "isoftbet-empty-player";

export class ISoftBetWalletAdapter implements IWalletAdapter {
    sessionExpiryMinutes = 5;
    wallet!: string;
    config!: IConfig;
    private cipher!: Cipher;

    private validateServer(hash: string, string: string) {
        if (hash !== crypto.createHmac("sha256", this.config.secretKey).update(string).digest("hex")) {
            throw new Exception("Couldn't authorize the server", {status: StatusCode.BAD_REQUEST, code: errorCodes.SERVER_UNAUTHORIZED});
        }
    }

    async init(wallet: string, api: Express, path: string, config: IConfig) {
        this.wallet = wallet;
        this.config = config;

        this.cipher = new Cipher(this.config.secretKey, this.wallet);

        api.get(path + "/launch", async (req: Request<unknown, unknown, unknown, ILunchReal | ILaunchFun>, res) => {
            try {
                const language = req.query.language;
                const game = req.query.providergameid;
                const lobbyUrl = req.query.lobbyurl || "";
                const licenseeId = req.query.licenseeid.toString();

                if (req.query.mode === "fun") {
                    const launchUrl = await launch("fun", {lobbyUrl, language, game, operator: licenseeId}, req);
                    res.redirect(launchUrl);
                } else if (req.query.mode === "real") {
                    const realityCheckInterval = req.query.rci?.toString() || "";
                    const historyUrl = req.query.historyurl || "";
                    const jurisdiction = req.query.jurisdiction?.toLowerCase();

                    const {providergameid, licenseeid, operator, playerid, username, currency, country, isbskinid, isbgameid, extra, token} = req.query;
                    const standardRequest: IStandardRequest = {providergameid, licenseeid, operator, playerid, username, currency, country, ISBskinid: isbskinid, ISBgameid: isbgameid, extra, token};

                    const keyData: IKeyData = [standardRequest, {jurisdiction}];
                    const key = this.cipher.encrypt(JSON.stringify(keyData));

                    const launchUrl = await launch("real", {wallet, operator: licenseeId, lobbyUrl, language, game, key, realityCheckInterval, historyUrl}, req);
                    res.redirect(launchUrl);
                }
            } catch {
                throw new Exception("Incorrect launch params", {data: {query: req.query}});
            }
        });

        api.all(path + "/gsp/freerounds_create", async (req: Request<any, IFreeRoundsResponse, IFreeRoundsCreateRequest, any>, res) => {
            try {
                this.validateServer(req.body.auth.signature, JSON.stringify(req.body.request));
                await this.createFreeRounds(req);
                res.json({success: true, message: "Freeround package created successfully!"});
            } catch (e) {
                res.json({success: false, error: e instanceof Exception ? e.message : "Unknown error"});
            }
        });

        api.all(path + "/gsp/freerounds_cancel", async (req: Request<any, IFreeRoundsResponse, IFreeRoundsCancelRequest, any>, res) => {
            try {
                this.validateServer(req.body.auth.signature, JSON.stringify(req.body.request));
                await this.cancelFreeRounds(req);
                res.json({success: true, message: "Cancelled freeround successfully!"});
            } catch (e) {
                res.json({success: false, error: e instanceof Exception ? e.message : "Unknown error"});
            }
        });

        api.all(path + "/gsp/players_register", async (req: Request<any, IFreeRoundsResponse, IFreeRoundsPlayerRegister, any>, res) => {
            try {
                this.validateServer(req.body.auth.signature, JSON.stringify(req.body.request));
                await this.registerFreeRoundsPlayer(req);
                res.json({success: true, message: "Players registered successfully!"});
            } catch (e) {
                res.json({success: false, error: e instanceof Exception ? e.message : "Unknown error"});
            }
        });

        api.all(path + "/gsp/players_remove", async (req: Request<any, IFreeRoundsResponse, IFreeRoundsPlayerRemove, any>, res) => {
            try {
                this.validateServer(req.body.auth.signature, JSON.stringify(req.body.request));
                await this.removeFreeRoundsPlayer(req);
                res.json({success: true, message: "Players removed successfully!"});
            } catch (e) {
                res.json({success: false, error: e instanceof Exception ? e.message : "Unknown error"});
            }
        });

        api.all(path + "/gsp", async (req: Request<any, any, any, any>, res) => {
            if (req.query.command === "player_round_history") {
                this.validateServer(req.query.hash, req.query.command + "," + req.query.roundid);
                return this.playerRoundHistory(req, res);
            }
            if (req.body.command === "force_close_rounds") {
                this.validateServer(req.query.hash, (req as any).rawBody);
                return this.forceCloseRounds(req, res);
            }
            if (req.body.command === "get_coin_values") {
                this.validateServer(req.query.hash, (req as any).rawBody);
                return this.getCoinValues(req, res);
            }
            if (req.body.command === "get_critical_files") {
                this.validateServer(req.query.hash, (req as any).rawBody);
                return this.getCriticalFiles(req, res);
            }
            throw new Exception("Unidentified command");
        });
    }

    private async createFreeRounds(req: Request<any, IFreeRoundsResponse, IFreeRoundsCreateRequest, any>) {
        const name = idToCampaignName(req.body.request.freeround_id);
        const start = req.body.request.start_date ? new Date(req.body.request.start_date).getTime() : undefined;
        const end = req.body.request.end_date ? new Date(req.body.request.end_date).getTime() : undefined;
        const wallets = [this.wallet];
        if (Object.keys(req.body.request.games_id).length !== 1) throw new Exception("Free rounds can be created only for a single game");
        const gamesConfig = req.body.request.games_id[Object.keys(req.body.request.games_id)[0]];
        if (gamesConfig.length !== 1) throw new Exception("Free rounds can be created only for a single coin_value");
        if (Object.keys(req.body.request.games_id).length !== 1) throw new Exception("Free rounds can be created only for a single game");
        const game = Object.keys(req.body.request.games_id)[0];
        const {provider} = await Game.get(game);
        const providers = [provider];
        const bets = req.body.request.limit_per_player;
        const amount = moneyFromISoftBet(gamesConfig[0].coin_value);
        const currency = gamesConfig[0].currency.toLowerCase();
        const games = [game];
        const nativeIds = [freeRoundsEmptyPlayer]; //players are assigned in a separate call
        const operators = [req.body.request.licensee_id.toString()];

        await createCampaign({type: "freeBets", name, start, end, wallets, providers, operators, games, nativeIds, config: {bets, amount, currency}});
    }

    private async cancelFreeRounds(req: Request<any, IFreeRoundsResponse, IFreeRoundsCancelRequest, any>) {
        const name = idToCampaignName(req.body.request.freeround_id);
        const campaign = await getCampaignByName(name);
        if (!campaign) throw new Exception(`Couldn't find campaign named ${name}`);

        await cancelCampaign(campaign.campaignId);
    }

    private async registerFreeRoundsPlayer(req: Request<any, IFreeRoundsResponse, IFreeRoundsPlayerRegister, any>) {
        const name = idToCampaignName(req.body.request.freeround_id);
        const campaign = await getCampaignByName(name);
        if (!campaign) throw new Exception(`Couldn't find campaign named ${name}`);

        const nativeIdsToAdd = req.body.request.player_ids.map(id => toNativeId(req.body.request.licensee_id, id));
        const nativeIds = campaign.nativeIds;
        for (const nativeId of nativeIdsToAdd) {
            if (!nativeIds.includes(nativeId)) {
                nativeIds.push(nativeId);
            }
        }
        await editCampaign(campaign.campaignId, {nativeIds});
    }

    private async removeFreeRoundsPlayer(req: Request<any, IFreeRoundsResponse, IFreeRoundsPlayerRemove, any>) {
        const name = idToCampaignName(req.body.request.freeround_id);
        const campaign = await getCampaignByName(name);
        if (!campaign) throw new Exception(`Couldn't find campaign named ${name}`);

        const nativeIdsToRemove = req.body.request.player_ids.map(id => toNativeId(req.body.request.licensee_id, id));
        const nativeIds = campaign.nativeIds;
        for (const nativeId of nativeIdsToRemove) {
            const index = nativeIds.indexOf(nativeId);
            if (index >= 0 && nativeId !== freeRoundsEmptyPlayer) {
                nativeIds.splice(index, 1);
            }
        }
        await editCampaign(campaign.campaignId, {nativeIds});
    }

    private async getCoinValues(req: Request<unknown, unknown, IGetCoinValues, unknown>, res: Response) {
        const games = req.body.providergameids;
        const games_setting: ICoinValues = {};

        for (const {currency} of (await currencies()).currencies) {
            for (const game of games) {
                try {
                    const {provider} = await Game.get(game);
                    const variables = {wallet: this.wallet, provider, game, currency, operator: "demo"};
                    const query = gql`
                        query ($wallet: String!, $operator: String!, $brand: String, $provider: String!, $game: String!, $currency: String!) {
                            availableBets(wallet: $wallet, operator: $operator, brand: $brand, provider: $provider, game: $game, currency: $currency) {
                                bets
                            }
                        }
                    `;
                    const response = await fetch(getServiceUrl("rgs") + "/graphql", {
                        headers: {"Content-Type": "application/json"},
                        method: "POST",
                        body: JSON.stringify({query, variables, account: {}}),
                    });
                    const body = await response.json();
                    const mainBets = body.data?.availableBets?.bets?.main;
                    if (mainBets) {
                        games_setting[game] ||= {};
                        games_setting[game][currency.toUpperCase()] = {coins: mainBets.available.map(moneyToISoftBet), default_coin: moneyToISoftBet(mainBets.available[0])};
                    }
                } catch {
                    //skip game in case of error
                }
            }
        }
        const licensees: Record<string, ICoinValues> = {};

        res.json({status: "success", licensees, games_setting});
    }

    private async getCriticalFiles(req: Request<unknown, unknown, IGetCriticalFiles, unknown>, res: Response) {
        const criticalFiles: ICriticalFile[] = [];
        const criticalFilesList = await getCriticalFiles({games: req.body.providergameids});
        for (const {name, jurisdictions, loggedChecksum, component} of criticalFilesList.items) {
            for (const jurisdiction of jurisdictions || []) {
                let marketFiles = criticalFiles.find(f => f.market === jurisdiction.toUpperCase());
                if (!marketFiles) {
                    marketFiles = {market: jurisdiction.toUpperCase(), market_files: []};
                    criticalFiles.push(marketFiles);
                }
                marketFiles.market_files.push({name, type: "file", hash: loggedChecksum, providergameid: component});
            }
        }
        res.json({status: "success", critical_files: criticalFiles});
    }

    private async playerRoundHistory(req: Request<unknown, unknown, unknown, IPlayerRoundHistory>, res: Response) {
        try {
            const game = req.query.providergameid;
            const language = req.query.language?.toLowerCase();
            const roundId = req.query.roundid;
            const operator = req.query.licensee.toString();
            const launchUrl = await launch("replay", {language, game, operator, roundId}, req);
            res.redirect(launchUrl);
        } catch {
            throw new Exception("Incorrect params");
        }
    }

    private async forceCloseRounds(req: Request<unknown, unknown, IForceCloseRounds>, res: Response) {
        for (const round of req.body.rounds) {
            const roundId = round.roundid;
            await Transaction.update({roundId, type: "deposit", status: "failed"}, {status: "finished", finishedAt: new Date()});
            await Transaction.update({roundId, type: "withdraw", status: "cancel"}, {status: "cancelled", cancelledAt: new Date()});
        }
        res.json({"status": "success"});
    }

    private async getCampaignNameById(campaignId: string): Promise<string | undefined> {
        return (await getFreeBetsCampaignDetails(campaignId))?.name;
    }

    private async fetch<TParams extends IRequest<unknown>, TResponse extends IResponse<unknown>>(params: TParams, repeat: number, endSessionOnError: boolean, sessionId?: string): Promise<TResponse> {
        const body = JSON.stringify(params);
        const hash = crypto.createHmac("sha256", this.config.secretKey).update(body).digest("hex");
        const headers: Record<string, string> = {"Content-Type": "application/json"};
        let json: any;
        let text;
        const url = `${this.config.url}`;

        do {
            let popup: IExceptionPopup = {message: "serverErrorMessage", buttons: [{label: "stop", action: "exit"}]};
            try {
                const response = await fetch(`${this.config.url}?hash=${hash}`, {method: "POST", body, headers, timeout: 10 * 1000});
                text = await response.text();
                json = JSON.parse(text);
            } catch (e) {
                if (repeat === 0) {
                    if (endSessionOnError && !!sessionId) {
                        await proxy.endActiveSession("error", sessionId);
                    }
                    throw new Exception("Couldn't fetch from wallet", {status: StatusCode.BAD_REQUEST, code: errorCodes.UNKNOWN, data: {error: e}, popups: [popup]});
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text});
            }
            if (json?.status === "error") {
                if (json.display) {
                    let buttons;
                    if (json.action === "void") buttons = [{label: "stop", action: "exit"}];
                    if (json.action === "continue") buttons = [{label: "continue", action: "close"}];
                    if (json.action === "buttons")
                        buttons = json.buttons?.buttons.map((button: any) => {
                            const actions: any = {"void": "exit", "continue": "close", "history": "history"};
                            return {label: button.text, action: actions[button.action], preventClose: button.action === "history"};
                        });
                    popup = {message: json.message, buttons};
                }

                const endSession = json.action === "void" && endSessionOnError && !!sessionId;
                if (json.code?.indexOf("ER") !== 0 || repeat === 0) {
                    if (endSession) {
                        await proxy.endActiveSession("error", sessionId);
                    }
                    throw new Exception(json.message || "Wallet returned error", {status: StatusCode.BAD_REQUEST, code: errorCodes.UNKNOWN, data: {error: json}, popups: [popup]});
                }
            }
            if (json && json?.status !== "error") {
                return json as TResponse;
            }
        } while (--repeat >= 0);
        throw new Exception("Couldn't process iSoftBet fetch request", {data: {wallet: this.wallet, request: {url, params}, response: json || text}});
    }

    async authenticate(key: string, operator: string, provider: string, game: string) {
        let decrypted: IKeyData;
        try {
            decrypted = JSON.parse(this.cipher.decrypt(key));
        } catch (e) {
            throw new Exception("Incorrect authentication key", {data: {key, wallet: this.wallet, error: e}});
        }
        const [standardRequest, {jurisdiction}] = decrypted;

        const params: IInitSessionRequest = {...standardRequest, action: {command: "initsession"}, state: "single"};
        const nativeId = toNativeId(standardRequest.licenseeid, standardRequest.playerid);
        const currency = standardRequest.currency.toLowerCase();
        const country = standardRequest.country?.toLowerCase();

        const brand = standardRequest.operator;
        const nickname = standardRequest.username;

        //fail if pending cancels
        const player = await Player.findOneBy({wallet: this.wallet, nativeId});
        if (player && (await Transaction.findOne({where: {playerId: player.id, type: "withdraw", status: "cancel", provider, game}, order: {createdAt: "DESC"}}))) {
            throw new Exception("The player has pending transaction with 'cancel' status");
        }

        if (player) {
            const session = await Session.findOneBy({playerId: player.id, provider, game, active: true});
            if (session) await this.end(player, "authenticate", session);
        }

        const data = await this.fetch<IInitSessionRequest, IInitSessionResponse>(params, 0, false);
        const {sessionid} = data;
        const balance = data.balance;
        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance, nativeId}});
        if (typeof sessionid !== "string") throw new Exception("Incorrect sessionid returned", {data: {data, sessionid, nativeId}});

        const token = this.cipher.encrypt(JSON.stringify({...standardRequest, sessionid}));

        return {nativeId, token, currency, balance: moneyFromISoftBet(balance), country, brand, nickname, jurisdiction};
    }

    async end(player: Player, reason: "expired" | "authenticate" | "error", session: ISession): Promise<void> {
        const standardRequest: IStandardRequest = JSON.parse(this.cipher.decrypt(session.token));
        const statuses: any = {"expired": "CLOSE", "authenticate": "CLOSE", "error": "ERROR"};
        const params: IEndRequest = {...standardRequest, state: "single", action: {command: "end", parameters: {sessionstatus: statuses[reason]}}};
        await this.fetch<IEndRequest, IEndResponse>(params, 2, false);
    }

    async balance(player: Player, provider: string, game: string, {token, sessionId}: ISession) {
        const standardRequest: IStandardRequest = JSON.parse(this.cipher.decrypt(token));
        const params: IBalanceRequest = {...standardRequest, state: "single", action: {command: "balance"}};
        const data = await this.fetch<IBalanceRequest, IBalanceResponse>(params, 0, true, sessionId);
        const {balance} = data;

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance}});

        return {balance: moneyFromISoftBet(balance)};
    }

    async transaction(player: Player, transaction: IWalletTransaction, {token, sessionId}: ISession) {
        const {createdAt, status} = (await Transaction.findOneBy({id: transaction.transactionId}))!;
        const STOP_REPEATING_HOURS = 24 * 60 * 60 * 1000; /*24 hours*/
        const repeat = status === "failed" ? 0 : 2;
        if (Date.now() - createdAt.getTime() >= STOP_REPEATING_HOURS) {
            throw new Exception("Transaction can't be repeated after 24 hours");
        }

        let freeRoundId: number | null = null;
        if (transaction.campaignType === "freeBets") {
            const campaignName = await this.getCampaignNameById(transaction.campaignId!);
            if (campaignName) freeRoundId = idFromCampaignName(campaignName);
        }
        const standardRequest: IStandardRequest = JSON.parse(this.cipher.decrypt(token));
        let balance: number;
        if (transaction.type === "withdraw") {
            const params: IBetRequest = {
                ...standardRequest,
                state: "single",
                action: {
                    command: "bet",
                    parameters: {
                        transactionid: transaction.transactionId,
                        roundid: transaction.roundId,
                        amount: moneyToISoftBet(transaction.amount),
                    },
                },
            };
            if (freeRoundId !== null) params.action.parameters!.freeroundid = freeRoundId;
            const data = await this.fetch<IBetRequest, IBetResponse>(params, repeat, true, sessionId);
            balance = data.balance;
        } else {
            if (transaction.category === "promo") {
                const params: IDepositMoneyRequest = {
                    ...standardRequest,
                    state: "single",
                    action: {
                        command: "depositmoney",
                        parameters: {
                            transactionid: transaction.transactionId,
                            amount: moneyToISoftBet(transaction.amount),
                            offerid: transaction.campaignId!,
                            type: transaction.campaignType!,
                            description: transaction.name,
                        },
                    },
                };
                const data = await this.fetch<IDepositMoneyRequest, IDepositMoneyResponse>(params, repeat, true, sessionId);
                balance = data.balance;
            } else {
                const params: IWinRequest = {
                    ...standardRequest,
                    state: "single",
                    action: {
                        command: "win",
                        parameters: {
                            transactionid: transaction.transactionId,
                            roundid: transaction.roundId,
                            amount: moneyToISoftBet(transaction.amount),
                            closeround: transaction.roundFinished,
                        },
                    },
                };
                if (freeRoundId !== null) params.action.parameters!.freeroundid = freeRoundId;
                const data = await this.fetch<IWinRequest, IWinResponse>(params, repeat, true, sessionId);
                balance = data.balance;
            }
        }

        if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {transaction, balance}});
        return {balance: moneyFromISoftBet(balance)};
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession) {
        const standardRequest: IStandardRequest = JSON.parse(this.cipher.decrypt(session.token));
        const params: ICancelRequest = {
            ...standardRequest,
            state: "single",
            action: {
                command: "cancel",
                parameters: {
                    transactionid: transaction.transactionId,
                    roundid: transaction.roundId,
                    amount: moneyToISoftBet(transaction!.amount),
                },
            },
        };
        if (transaction!.campaignType === "freeBets") {
            const campaignName = await this.getCampaignNameById(transaction!.campaignId!);
            params.action.parameters!.freeroundid = idFromCampaignName(campaignName!);
        }
        try {
            const data = await this.fetch<ICancelRequest, ICancelResponse>(params, 0, false);
            const {balance} = data;
            if (typeof balance !== "number") throw new Exception("Incorrect balance returned", {data: {data, balance}});
            return {balance: moneyFromISoftBet(balance)};
        } catch (e) {
            const code = e instanceof Exception ? e.code : null;
            if (code === errorCodes.TRANSACTION_FAILED) {
                return await this.balance(player, transaction.provider!, transaction.game!, session);
            }
            throw e;
        }
    }
}

export default ISoftBetWalletAdapter;
