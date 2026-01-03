import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {Express, NextFunction, Request, Response} from "express";
import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import logger from "@slotify/shared/lib/logger";
import fetch, {fetchAndParse} from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import launch, {IParamsFun, IParamsReal} from "../route/launch";
import {v4} from "uuid";
import {Player} from "../db/model/Player";
import {Transaction} from "../db/model/Transaction";
import {StatusCode} from "@slotify/shared/lib/StatusCode";
import {cancelCampaign, createCampaign, getAvailableBets, getFreeBetsCampaignDetails, getFreeBetsPlayerDetails, getNativePlayerActiveFreeBetsCampaigns} from "../util/external";
import {URLSearchParams} from "url";
import {Game} from "../db/model/Game";
import {ipFilter} from "../util/ip";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {Session} from "../db/model/Session";
import {getServiceUrl, isServiceAvailable} from "@slotify/shared/lib/urls";
import {errorCodes, getWalletAdapter} from "./walletAdapter";
import {registerSchedulerCallback, scheduleTask} from "@slotify/shared/lib/scheduler";

type ILauncherQueryParams = {
    gameid: string;
    ticket: string;
    jurisdiction: string;
    lang: string;
    channel: string;
    partnerid: string;
    moneymode: "fun" | "real";
    clientid: string;
    homeurl: string;
    rcinterval: string;
    rcelapsed: string;
    currency: string;
    rchistoryurl: string;
    rcenable: string;
    rciframeurl: string;
};

type IConfig = {
    url: string;
    user: string;
    password: string;
    platformCode: string;
    providers: Record<string, {code: string; name: string; rng?: {identification: string; softwareid: string}}>;
    timeout?: number;
    currencyAliasesPerBrand?: Record<string, Record<string, string>>;
    cancelDelay?: number;
};

type IRelaxApiMethod = "verifytoken" | "withdraw" | "deposit" | "rollback" | "getbalance" | "ackpromotionadd" | "finalizeround";

const operator = "relax";

export class RelaxWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    cipher!: Cipher;

    async init(wallet: string, api: Express, path: string, config: IConfig, whitelistedIps?: string[]) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.user + ":" + this.config.password, this.wallet);

        api.get(path + "/launcher", async (req: Request<unknown, unknown, unknown, ILauncherQueryParams>, res: any) => {
            const game = req.query["gameid"];
            const ticket = req.query["ticket"];
            const language = req.query["lang"];
            const channel = req.query["channel"];
            const brand = req.query["partnerid"];
            const mode = req.query["moneymode"];
            const clientid = req.query["clientid"];
            const lobbyUrl = req.query["homeurl"];
            const realityCheckInterval = this.mapRealityCheckValue(req.query["rcinterval"]);
            const realityCheckElapsed = this.mapRealityCheckValue(req.query["rcelapsed"]);
            const realityCheckGameHistoryUrl = req.query["rchistoryurl"];
            const rcenable = req.query["rcenable"];
            const rciframeurl = req.query["rciframeurl"];

            let launchUrl: string;
            if (mode === "fun") {
                const key = this.createDemoWalletPlayerKey(req.query["currency"], brand, req.query["jurisdiction"]);
                const launchData = clearEmpty({
                    game,
                    operator,
                    language,
                    lobbyUrl,
                    homeurl: lobbyUrl,
                    realityCheckInterval,
                    realityCheckElapsed,
                    realityCheckGameHistoryUrl,
                    rcenable,
                    rciframeurl,
                    key,
                }) as IParamsFun;
                launchUrl = await launch("fun", launchData, req);
            } else {
                const key = this.cipher.encrypt(JSON.stringify({ticket, channel, brand, clientid, salt: Date.now()}));
                const launchData = clearEmpty({
                    game,
                    operator,
                    wallet,
                    language,
                    lobbyUrl,
                    homeurl: lobbyUrl,
                    realityCheckInterval,
                    realityCheckElapsed,
                    realityCheckGameHistoryUrl,
                    rcenable,
                    rciframeurl,
                    key,
                }) as IParamsReal;
                launchUrl = await launch("real", launchData, req);
            }

            res.redirect(launchUrl);
        });

        api.post(path + "/replay/get", ipFilter(whitelistedIps), this.validateWallet.bind(this), async (req, res) => {
            try {
                const roundId = req.body.roundid;
                const [language] = (req.body.locale || "en_US").toLowerCase().split("_");

                const roundTransactions = await Transaction.findBy({roundId});

                const earliestTransaction = roundTransactions.reduce((previous, current) => (previous.createdAt < current.createdAt ? previous : current));

                const latestTransaction = roundTransactions.reduce((previous, current) => (previous.createdAt > current.createdAt ? previous : current));

                const totalBet = roundTransactions.filter(transaction => transaction.type === "withdraw").reduce((sum, transaction) => sum + transaction.amount, 0);

                const totalWin = roundTransactions.filter(transaction => transaction.type === "deposit").reduce((sum, transaction) => sum + transaction.amount, 0);

                const player = await Player.findOneByOrFail({id: earliestTransaction.playerId});

                const replayUrl = await launch(
                    "replay",
                    {
                        roundId: earliestTransaction.roundId,
                        language,
                        operator: player.operator,
                        game: earliestTransaction.game,
                    },
                    req,
                );

                res.json({
                    replayurl: replayUrl,
                    roundstart: this.mapDateToRelaxFormat(earliestTransaction.createdAt),
                    roundend: this.mapDateToRelaxFormat(latestTransaction.createdAt),
                    betamount: this.toRelaxMoney(totalBet),
                    winamount: this.toRelaxMoney(totalWin),
                    currency: this.toRelaxCurrency(player.currency, player.brand),
                });
            } catch (e: any) {
                res.status(500);
                res.json({
                    errorcode: "UNHANDLED",
                    errormessage: e.message,
                });
            }
        });

        api.post(path + "/freespins/add", ipFilter(whitelistedIps), this.validateWallet.bind(this), async (req, res) => {
            try {
                const {txid, campaignId} = await this.createFreeBets(req.body);

                res.json({txid, freespinsid: campaignId});
            } catch (e: any) {
                res.status(403);
                res.json({
                    errorcode: "INVALID_PARAMETERS",
                    errormessage: e.message,
                });
            }
        });

        api.post(path + "/freespins/get", ipFilter(whitelistedIps), this.validateWallet.bind(this), async (req, res) => {
            try {
                const {playerid} = req.body;
                const nativeId = playerid.toString();

                const player = await Player.findOneBy({nativeId, wallet});

                const campaignsData = await getNativePlayerActiveFreeBetsCampaigns(nativeId, "relax");

                const freespins = [];
                for (const campaignData of campaignsData) {
                    const game = campaignData.games[0];
                    const brand = campaignData.brands?.[0];
                    const {provider} = await Game.get(game);

                    if (!player) {
                        freespins.push(
                            clearEmpty({
                                freespinvalue: this.toRelaxMoney(campaignData.config.amount),
                                expires: this.mapDateToRelaxFormat(campaignData.end),
                                gameref: this.getGameReference(game, provider),
                                amount: campaignData.config.bets,
                                freespinsid: campaignData.campaignId,
                                createtime: this.mapDateToRelaxFormat(campaignData.createdAt),
                                currency: this.toRelaxCurrency(campaignData.config.currency!, brand),
                                promocode: this.getCampaignPromoCode(campaignData.name),
                            }),
                        );
                    } else {
                        const campaignPlayerDetails = await getFreeBetsPlayerDetails(campaignData.campaignId, player.id);

                        if (!campaignPlayerDetails || !campaignPlayerDetails.finished) {
                            // add campaigns that player hasn't initialised or hasn't finished yet

                            const gameData = await Game.findOneBy({game});
                            const params = new URLSearchParams({currency: player.currency, provider: gameData!.provider, game});
                            const {left, amount} = await fetchAndParse(getServiceUrl("promo") + "/feed/player/" + campaignData.campaignId + "/" + player.id + "?" + params.toString());

                            freespins.push(
                                clearEmpty({
                                    freespinvalue: this.toRelaxMoney(amount),
                                    expires: this.mapDateToRelaxFormat(campaignData.end),
                                    gameref: this.getGameReference(game, gameData!.provider),
                                    amount: left,
                                    freespinsid: campaignData.campaignId,
                                    createtime: this.mapDateToRelaxFormat(campaignData.createdAt),
                                    currency: this.toRelaxCurrency(player.currency, player.brand),
                                    promocode: this.getCampaignPromoCode(campaignData.name),
                                }),
                            );
                        }
                    }
                }

                res.json({freespins});
            } catch (e: any) {
                res.status(500);
                res.json({
                    errorcode: "UNHANDLED",
                    errormessage: e.message,
                });
            }
        });

        api.post(path + "/games/getgames", ipFilter(whitelistedIps), this.validateWallet.bind(this), async (req, res) => {
            const {currency, credentials} = req.body;
            const brand = credentials.partnerid;

            const games = [];
            for (const [provider, data] of Object.entries(this.config.providers)) {
                const gamesData = await Game.findBy({provider});

                for (const gameData of gamesData) {
                    if (!(await Game.verify(gameData.game, wallet, operator))) continue;
                    try {
                        const bets = await getAvailableBets({wallet, operator, provider, game: gameData.game, currency: this.fromRelaxCurrency(currency, brand)});

                        const categories = {"slot": "slot", "live": "other", "lottery": "other", "poker": "other", "tableGame": "other", "videoPoker": "other", "other": "other"};
                        games.push({
                            gameref: this.getGameReference(gameData.game, gameData.provider),
                            name: gameData.title ? gameData.title : gameData.game,
                            studio: this.config.providers[provider].name,
                            channels: ["web", "mobile"],
                            freespins: {
                                channels: ["web", "mobile"],
                                types: ["regular"],
                            },
                            legalbetsizes: bets.map(bet => this.toRelaxMoney(bet)),
                            rng: data.rng,
                            category: gameData.type ? categories[gameData.type] : undefined,
                        });
                    } catch (e) {
                        logger.warn("Couldn't fetch available bets", {provider, gameData, e});
                    }
                }
            }

            res.json({games});
        });

        api.post(path + "/freespins/cancel", ipFilter(whitelistedIps), this.validateWallet.bind(this), async (req, res) => {
            try {
                const {freespinsid, playerid} = req.body;
                const campaignId = freespinsid;
                const nativeId = playerid.toString();

                await this.closeFreeBetsCampaign(nativeId, campaignId);

                await cancelCampaign(campaignId);

                res.json({freespinsid});
            } catch (e: any) {
                res.status(500);
                res.json({
                    errorcode: "UNHANDLED",
                    errormessage: e.message,
                });
            }
        });

        api.post(path + "/finalize", ipFilter(whitelistedIps), this.validateWallet.bind(this), async (req, res) => {
            const {roundid, sessionid, partnerid} = req.body;
            try {
                const timestamp = Date.now() + 5 * 60 * 1000;

                await scheduleTask("finalizeRelaxRound", roundid, timestamp, {
                    wallet: this.wallet,
                    roundid,
                    sessionid,
                    partnerid,
                });

                res.json({
                    finalizedstatus: "OK",
                    sessionid,
                });
            } catch {
                res.json({
                    finalizedstatus: "Unavailable",
                    sessionid,
                });
            }
        });

        api.post(path + "/round/getstate", ipFilter(whitelistedIps), this.validateWallet.bind(this), async (req, res) => {
            const {roundid} = req.body;

            let gameref = null;
            let closedtime = null;
            let totalwinamount = null;

            const withdraw = await Transaction.findOne({
                where: {roundId: roundid, type: "withdraw"},
            });

            if (withdraw) {
                gameref = this.getGameReference(withdraw.game, withdraw.provider!);

                const deposit = await Transaction.findOne({
                    where: {roundId: roundid, type: "deposit"},
                });

                if (deposit) {
                    closedtime = this.mapDateToRelaxFormat(deposit.createdAt);
                    totalwinamount = this.toRelaxMoney(deposit.amount);
                } else {
                    totalwinamount = 0;
                }
            }

            res.json({closedtime, gameref, totalwinamount});
        });
    }

    async authenticate(encryptedUrlKey: string, operator: string, provider: string, game: string, ip: string): Promise<IWalletAuthenticate> {
        const {ticket, channel, brand, clientid} = JSON.parse(this.cipher.decrypt(encryptedUrlKey));

        const verifyTokenPayload = {
            requestid: v4(),
            timestamp: Date.now(),
            channel,
            clientid,
            token: ticket,
            gameref: this.getGameReference(game, provider),
            partnerid: Number.parseInt(brand, 10),
            ip,
        };

        const {playerid, customerid, countrycode, currency, jurisdiction, balance, sessionid, promotions, operatorbetsettings} = await this.fetch("verifytoken", brand, verifyTokenPayload);

        const nativeId = playerid.toString();

        let betConfig;
        if (operatorbetsettings) {
            betConfig = {
                minBet: operatorbetsettings.minimumbet != null ? this.fromRelaxMoney(operatorbetsettings.minimumbet) : undefined,
                maxBet: operatorbetsettings.maximumbet != null ? this.fromRelaxMoney(operatorbetsettings.maximumbet) : undefined,
                maxBonusBet: operatorbetsettings.maximumbet != null ? this.fromRelaxMoney(operatorbetsettings.maximumbet) : undefined,
                defaultBet: operatorbetsettings.defaultbet != null ? this.fromRelaxMoney(operatorbetsettings.defaultbet) : undefined,
            };
        }

        if (isServiceAvailable("promo")) {
            await this.acknowledgeCampaigns(promotions, channel, brand);
        }

        return {
            nativeId,
            nickname: customerid,
            token: sessionid,
            currency: this.fromRelaxCurrency(currency, brand),
            balance: this.fromRelaxMoney(balance),
            country: countrycode.toLowerCase(),
            jurisdiction: jurisdiction.toLowerCase(),
            brand,
            sessionData: {
                channel,
                clientid,
                sessionid,
                betConfig,
            },
        };
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession): Promise<IWalletBalance> {
        const txtype = await this.getTransactionType(transaction, player);

        const transactionPayload: any = {
            requestid: v4(),
            timestamp: transaction.type === "deposit" ? transaction.createdAt.getTime() : Date.now(),
            playerid: Number.parseInt(player.nativeId, 10),
            roundid: transaction.roundId,
            channel: session.data.channel,
            currency: this.toRelaxCurrency(player.currency, player.brand),
            clientid: session.data.clientid,
            txid: transaction.transactionId,
            sessionid: session.data.sessionid,
            amount: this.toRelaxMoney(transaction.amount),
            txtype,
            ended: transaction.roundFinished,
        };

        if (["freespinpayout", "freespinpayoutfinal"].includes(txtype)) {
            transactionPayload.freespinsid = transaction.campaignId;

            const {name} = (await getFreeBetsCampaignDetails(transaction.campaignId!))!;
            transactionPayload.promocode = this.getCampaignPromoCode(name);
        }

        if (txtype === "promopayout") {
            transactionPayload.promotionid = "rlx." + this.config.platformCode + "." + transaction.campaignId;
            transactionPayload.gameref = "promotion";
        } else {
            transactionPayload.gameref = this.getGameReference(transaction.game!, transaction.provider!);
        }

        if (transaction.type === "deposit") {
            const firstTransaction = await Transaction.findOne({
                where: {roundId: transaction.roundId},
                order: {createdAt: "ASC"},
            });
            transactionPayload.betamount = this.toRelaxMoney(firstTransaction!.amount);

            transactionPayload.replayurl = await launch("replay", {roundId: transaction.roundId, operator: player.operator, game: transaction.game!});

            if (firstTransaction!.data?.finalizeRelaxRound) {
                const finalizeRelaxRoundPayload = {
                    roundid: transaction.roundId,
                    finalizedstatus: "FINALIZED",
                    sessionid: session.data.sessionid,
                    depositdata: clearEmpty(transactionPayload),
                };

                await this.fetch("finalizeround", player.brand!, finalizeRelaxRoundPayload);
                return await this.balance(player, transaction.provider!, transaction.game!, session);
            }
        }

        const transactionResponse = await this.fetch(transaction.type, player.brand!, clearEmpty(transactionPayload));
        return transactionResponse.balance != null ? {balance: this.fromRelaxMoney(transactionResponse.balance)} : await this.balance(player, transaction.provider!, transaction.game!, session);
    }

    private async getTransactionType(transaction: IWalletTransaction, player: Player): Promise<string> {
        if (transaction.campaignType === "freeBets") {
            if (transaction.type === "withdraw") {
                return "freespinbet";
            }

            const campaignPlayerDetails = await getFreeBetsPlayerDetails(transaction.campaignId!, player.id);
            const campaignDetails = await getFreeBetsCampaignDetails(transaction.campaignId!);
            if (campaignPlayerDetails!.state.used < campaignDetails!.config.bets) {
                return "freespinpayout";
            }

            return "freespinpayoutfinal";
        }

        if (transaction.category === "promo" && transaction.type === "deposit") {
            return "promopayout";
        }

        return transaction.type;
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession): Promise<IWalletBalance> {
        const transactionEntity = await Transaction.findOneBy({id: transaction.transactionId});

        const cancelDelay = this.config.cancelDelay != null ? this.config.cancelDelay : 60 * 1000;
        if (Date.now() - transactionEntity!.createdAt.getTime() < cancelDelay) {
            throw new Exception("Skipping Relax initial cancel due to integration requirements", {data: {transactionEntity}});
        }

        const txtype = await this.getTransactionType(transaction, player);

        const transactionPayload = {
            requestid: v4(),
            timestamp: Date.now(),
            playerid: Number.parseInt(player.nativeId, 10),
            roundid: transaction.roundId,
            gameref: this.getGameReference(transaction.game!, transaction.provider!),
            currency: this.toRelaxCurrency(player.currency, player.brand),
            clientid: session.data.clientid,
            txid: "rollback_" + transaction.transactionId,
            originaltxid: transaction.transactionId,
            sessionid: session.data.sessionid,
            amount: this.toRelaxMoney(transaction.amount),
            txtype,
            ended: transaction.roundFinished,
            originaltimestamp: transactionEntity!.createdAt.getTime(),
        };

        await this.fetch("rollback", player.brand!, transactionPayload);

        return await this.balance(player, transaction.provider!, transaction.game!, session);
    }

    async balance(player: Player, provider: string, game: string, session: ISession): Promise<IWalletBalance> {
        const transactionPayload = {
            requestid: v4(),
            timestamp: Date.now(),
            playerid: Number.parseInt(player.nativeId, 10),
            gameref: this.getGameReference(game, provider),
            currency: this.toRelaxCurrency(player.currency, player.brand),
            sessionid: session.data.sessionid,
        };

        const {balance} = await this.fetch("getbalance", player.brand!, transactionPayload);

        return {balance: this.fromRelaxMoney(balance)};
    }

    private async fetch(apiMethod: IRelaxApiMethod, brand: string | number, payload: any): Promise<any> {
        const url = this.config.url + "/" + brand + "/" + apiMethod;
        const method = "POST";
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Authorization": this.getAuthorizationHeader(),
        };

        let response;
        let text;
        let json;

        try {
            const body = JSON.stringify(payload);

            response = await fetch(url, {method, body, headers, timeout: (this.config.timeout || 30) * 1000});
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

        if (response && response.status >= 200 && response.status <= 299) {
            // success
            return json;
        } else if (response && response.status >= 400 && response.status <= 499) {
            // non-retriable, no rollback
            const {code, payload} = this.mapNonRetriableError(json);
            throw new Exception(json.errormessage || "Wallet returned error", {
                status: response.status,
                code,
                payload,
                popups: this.getErrorPopups(json),
            });
        } else {
            // retriable
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
            popups: this.getErrorPopups(json),
        });
    }

    private getAuthorizationHeader() {
        return "Basic " + Buffer.from(this.config.user + ":" + this.config.password).toString("base64");
    }

    private validateWallet(req: Request, res: Response, next: NextFunction) {
        if (req.headers["Authorization"] === this.getAuthorizationHeader() || req.headers["authorization"] === this.getAuthorizationHeader()) {
            return next();
        }
        throw new Exception("couldn't authorize the server", {status: StatusCode.UNAUTHORIZED, code: "SERVER_UNAUTHORIZED"});
    }

    private getGameReference(game: string, provider: string) {
        return "rlx." + this.config.platformCode + "." + this.config.providers[provider].code + "." + game;
    }

    private getGameName(gameReference: string) {
        const regex = /^rlx\..*\..*\.(.+)$/;
        const match = gameReference.match(regex);
        if (match && match[1]) {
            return match[1];
        }
        throw new Exception("couldn't extract game name from game reference");
    }

    private toRelaxMoney(amount: number): number {
        return Math.round(amount * 100);
    }

    private fromRelaxMoney(amount: any): number {
        if (typeof amount !== "number") {
            throw new Exception("incorrect incoming balance");
        }

        return amount / 100;
    }

    fromRelaxCurrency(relaxCurrency?: string, brand?: string): string {
        if (!relaxCurrency) {
            return "eur";
        }
        if (brand && this.config.currencyAliasesPerBrand?.[relaxCurrency]?.[brand]) {
            return this.config.currencyAliasesPerBrand[relaxCurrency][brand];
        }
        return relaxCurrency.toLowerCase();
    }

    toRelaxCurrency(currency: string, brand?: string) {
        if (this.config.currencyAliasesPerBrand && brand) {
            for (const [relaxCurrency, aliasesPerBrand] of Object.entries(this.config.currencyAliasesPerBrand)) {
                if (aliasesPerBrand[brand] === currency) {
                    return relaxCurrency;
                }
            }
        }
        return currency.toUpperCase();
    }

    private getCampaignName(id: number, promocode?: string) {
        return promocode ? "relax_" + id + "_" + promocode : "relax_" + id;
    }

    private getCampaignPromoCode(campaignName: string): string | undefined {
        const regex = /^relax_.*?_(.+)$/;
        const match = campaignName.match(regex);
        if (match && match[1]) {
            return match[1];
        }
    }

    private getErrorPopups(json: any): IExceptionPopup[] | undefined {
        const errorParameters = json?.errorparameters?.errorDetails;
        return errorParameters
            ? [
                  {
                      title: errorParameters.title,
                      message: errorParameters.message,
                      buttons: [{label: errorParameters.buttontext, action: "exit"}],
                  },
              ]
            : undefined;
    }

    private mapNonRetriableError(json: {errorcode: string; errorparameters: any}): {code: string; payload: any} {
        const payload = json.errorparameters ? {errorparameters: json.errorparameters} : undefined;

        switch (json.errorcode) {
            case "IP_BLOCKED":
                return {code: errorCodes.BLOCKED_TERRITORY, payload};
            case "INSUFFICIENT_FUNDS":
                return {code: errorCodes.INSUFFICIENT_FUNDS, payload};
            case "SPENDING_BUDGET_EXCEEDED":
                return {code: errorCodes.LOSS_LIMIT, payload};
            case "DAILY_TIME_LIMIT":
                return {code: errorCodes.TIME_LIMIT, payload: {period: "day"}};
            case "WEEKLY_TIME_LIMIT":
                return {code: errorCodes.TIME_LIMIT, payload: {period: "week"}};
            case "MONTHLY_TIME_LIMIT":
                return {code: errorCodes.TIME_LIMIT, payload: {period: "month"}};
            default:
                return {code: errorCodes.TRANSACTION_FAILED, payload};
        }
    }

    private mapRealityCheckValue(interval?: string): string | undefined {
        return interval ? (Number.parseInt(interval, 10) / 60).toString() : undefined;
    }

    private mapDateToRelaxFormat(date: Date): string {
        return new Date(date).toISOString().split(".")[0] + "Z";
    }

    private createDemoWalletPlayerKey(relaxCurrency?: string, brand?: string, relaxJurisdiction?: string): string | undefined {
        if (relaxCurrency || relaxJurisdiction) {
            const currency = this.fromRelaxCurrency(relaxCurrency, brand);
            const jurisdiction = relaxJurisdiction ? relaxJurisdiction.toLowerCase() : "mt";
            return `relax_${v4()}:10000:${currency}:${jurisdiction}`;
        }
    }

    private async createFreeBets(requestBody: any): Promise<{txid: string; campaignId: string}> {
        const {amount, currency, expires, freespinvalue, gameref, playerid, partnerid, txid, promocode} = requestBody;

        const nativeId = playerid.toString();
        const brand = partnerid.toString();
        const end = new Date(expires).getTime();

        const campaignId = await createCampaign({
            type: "freeBets",
            name: this.getCampaignName(txid, promocode),
            end,
            wallets: [this.wallet],
            brands: [brand],
            games: [this.getGameName(gameref)],
            nativeIds: [nativeId],
            config: {
                bets: amount,
                amount: this.fromRelaxMoney(freespinvalue),
                currency: this.fromRelaxCurrency(currency, brand),
            },
        });

        await scheduleTask("closeRelaxFreeBetsCampaign", campaignId, end, {wallet: this.wallet, nativeId, campaignId});

        return {txid, campaignId};
    }

    private async acknowledgeCampaigns(promotions: any, channel: string, brand: string) {
        if (promotions) {
            const campaignsToAcknowledge = [];
            for (const promotion of promotions) {
                if (promotion.promotiontype === "freerounds") {
                    try {
                        const {txid, campaignId} = await this.createFreeBets(promotion);
                        const acknowledgedCampaign = {
                            data: {
                                channel,
                                freespinsid: campaignId,
                            },
                            playerid: promotion.playerid,
                            promotionid: promotion.promotionid,
                            txid,
                        };
                        campaignsToAcknowledge.push(acknowledgedCampaign);
                    } catch (err) {
                        logger.error("Unable to create Relax campaign", {promotion, err});
                    }
                } else {
                    logger.error("Only freespins/freerounds Relax campaigns are supported", {promotion});
                }
            }
            try {
                await this.fetch("ackpromotionadd", brand, {promotions: campaignsToAcknowledge});
            } catch (err) {
                logger.error("Relax acknowledge campaigns call failed", {promotions, err});
            }
        }
    }

    public async closeFreeBetsCampaign(nativeId: string, campaignId: string) {
        const expiredCampaign = await getFreeBetsCampaignDetails(campaignId);

        if (!expiredCampaign) {
            throw new Exception("Attempting to close non-existing Relax free spins campaign", {
                data: {
                    nativeId,
                    campaignId,
                },
            });
        }

        const player = await Player.findOneBy({nativeId, wallet: this.wallet});
        if (player) {
            // dont send update if player never entered the platform
            const playerId = player.id;

            const campaignDetails = await getFreeBetsCampaignDetails(campaignId);
            const campaignPlayerDetails = await getFreeBetsPlayerDetails(campaignId, playerId);

            if (
                campaignPlayerDetails && // send only if player initialised the campaign
                campaignPlayerDetails!.state.used > 0 && // send only if player used at least one bet
                campaignPlayerDetails!.state.used < campaignDetails!.config.bets
            ) {
                // send only if player didn't use all bets

                const transaction = await Transaction.findOne({where: {playerId, campaignId, type: "deposit"}, order: {createdAt: "DESC"}});
                const session = await Session.findOneBy({sessionId: transaction!.sessionId});
                if (transaction) {
                    const transactionPayload: any = {
                        requestid: v4(),
                        timestamp: Date.now(),
                        playerid: Number.parseInt(player.nativeId, 10),
                        roundid: transaction.roundId,
                        sessionid: session!.data!.sessionid,
                        channel: session!.data!.channel,
                        currency: this.toRelaxCurrency(player.currency, player.brand),
                        txid: v4(),
                        amount: 0,
                        txtype: "freespinpayoutfinal",
                        ended: transaction.roundFinished,
                        freespinsid: campaignId,
                        promocode: this.getCampaignPromoCode(campaignDetails!.name),
                        gameref: this.getGameReference(transaction.game!, transaction.provider!),
                    };

                    await this.fetch("deposit", player.brand!, clearEmpty(transactionPayload));

                    logger.info("Resolving Relax free spins and send freespinpayoutfinal", {expiredCampaign, player, campaignDetails, campaignPlayerDetails});
                } else {
                    logger.warn("Couldn't find deposit transaction related to Relax free spins campaign (player didn't finish the round)", {expiredCampaign, player, campaignDetails, campaignPlayerDetails});
                }
            } else {
                logger.info("Resolving Relax free spins campaign for the player without freespinpayoutfinal (player didn't show during the campaign, or used all spins)", {expiredCampaign, player, campaignDetails, campaignPlayerDetails});
            }
        } else {
            logger.info("Resolving Relax campaign for the player without freespinpayoutfinal (player didn't show up on the platform)", {expiredCampaign});
        }
    }

    public async finalizeRound(roundid: string, sessionid: number, partnerid: number) {
        const firstTransaction = await Transaction.findOne({where: {roundId: roundid}, order: {createdAt: "ASC"}});

        if (!firstTransaction) {
            await this.fetch("finalizeround", partnerid, {
                roundid,
                finalizedstatus: "NOROUND",
                sessionid,
            });
        } else {
            try {
                await Transaction.update({id: firstTransaction.id}, {data: {finalizeRelaxRound: true}});
                const body = JSON.stringify({roundId: roundid});
                await fetchAndParse(`${getServiceUrl("rgs")}/api/autoCompleteRound/`, {
                    method: "POST",
                    body,
                    headers: {"Content-Type": "application/json"},
                });
            } catch (error) {
                logger.warn("Couldn't finalizeRelaxRound", {error, roundid, sessionid, partnerid});
            }
        }
    }
}

registerSchedulerCallback(
    "finalizeRelaxRound",
    async data => {
        if (!data) return;
        const {wallet, roundid, sessionid, partnerid} = data;
        logger.info(`Scheduled finalizing Relax round for wallet "${wallet}" started`, {roundId: roundid});

        try {
            const walletAdapter = (await getWalletAdapter(wallet)) as RelaxWalletAdapter;
            await walletAdapter.finalizeRound(roundid, sessionid, partnerid);
        } catch {
            logger.warn("Couldn't close scheduled free bets Relax campaign, ignoring the callback", {
                wallet,
                roundid,
                sessionid,
                partnerid,
            });
        }
    },
    {once: true},
);

registerSchedulerCallback(
    "closeRelaxFreeBetsCampaign",
    async data => {
        if (!data) return;
        const {wallet, nativeId, campaignId} = data;
        logger.info(`Scheduled closing Free Bets campaign for wallet "${wallet}" started`, {nativeId, campaignId});
        if (isServiceAvailable("promo")) {
            try {
                const walletAdapter = (await getWalletAdapter(wallet)) as RelaxWalletAdapter;
                await walletAdapter.closeFreeBetsCampaign(nativeId, campaignId);
            } catch (error) {
                logger.warn("Couldn't close scheduled free bets Relax campaign, ignoring the callback", {
                    wallet,
                    nativeId,
                    campaignId,
                    error,
                });
            }
        } else {
            logger.warn("Attempting to close scheduled free bets Relax campaign without promo service available, ignoring the callback");
        }
    },
    {once: true},
);

export default RelaxWalletAdapter;
