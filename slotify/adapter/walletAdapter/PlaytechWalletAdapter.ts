import Exception, {IExceptionPopup, IExceptionPopupButton} from "@slotify/shared/lib/Exception";
import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {Express, Request, Response} from "express";
import logger from "@slotify/shared/lib/logger";
import fetch, {Agent, fetchAndParse} from "@slotify/shared/lib/fetch";
import {v4} from "uuid";
import Cipher from "@slotify/shared/lib/Cipher";
import {Player} from "../db/model/Player";
import {decimals} from "./playtech/currencies";
import {StatusCode} from "@slotify/shared/lib/StatusCode";
import launch, {IParamsReal} from "../route/launch";
import {Transaction} from "../db/model/Transaction";
import {Game} from "../db/model/Game";
import {createHash} from "crypto";
import {ipFilter} from "../util/ip";
import {ISessionData} from "../db/model/Session";
import {errorCodes} from "./walletAdapter";
import {sendAlert} from "@slotify/shared/lib/sendAlert";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import proxy from "../route/proxy";

/**
 * POP Integration
 * API version: 23.8
 * HTTP Integration: v2 for "Game play" and v1 for the rest
 * Playtech free spins v2
 * Marketplace API
 */

type ILaunchParams = {
    game: string;
    playerid: string;
    licenseeid?: string;
    skinid: string;
    real: "0" | "1" | "2";
    token: string;
    language: string;
    clientplatform?: string;
    clienttype?: string;
    backurl: string;
    cashierurl: string;
    gamehistoryurl: string;
    crosslaunchurl?: string;
    supporturl: string;
    logouturl: string;
    imsgame: string;
    jurisdiction?: string;
    integration?: string;
};
type IDetailedGameHistory = {
    playerId: string;
    gameId: string;
    gameCycleId: string;
    languageCode: string;
    superDomain: string;
};
type IVerifyPlayerSessionRequest = {
    _meta: IMeta;
    localeCode: string;
    gameId: string;
    secureToken: string;
    skinId: string;
    playerId: string;
    includeUrls: boolean;
};
type IVerifyPlayerSessionResponse = {
    secureToken: string;
    gameId: string;
    accountBalance: {
        playerId: string;
        accountId: string;
        currencyCode: string;
        balanceArray: {
            balanceType: "cashable" | "freespin";
            balanceAmt: number;
        }[];
        balanceChangeDateTime?: string;
    };
    urls: {
        lobby?: string;
        history?: string;
        cashier?: string;
        support?: string;
        logout?: string;
    };
    sessionData?: {
        unfinishedGameCycleId: string;
        bonusRoundsRemaining?: number;
        maxAllowedBetAmt?: number;
    };
};
type IMeta = {
    gsId: string;
    gpId: string;
    requestId: string;
    clientPlatform?: string;
    clientType?: string;
    apiFeatures?: string[];
};
type IV2GamePlayRequest = {
    requestId: string;
    rgsId: string;
    token: string;
    casino: string;
    player: string;
};
type IV2GamePlayResult = {
    requestId: string;
};
type IBalanceData = {
    balanceTimestamp: number;
    balances: {
        type: "cashable" | "freeSpin";
        amount: number;
        currency: string;
    }[];
};
type IWagerRequest = IV2GamePlayRequest & {
    gameCycleData: {
        id: string;
        gameId: string;
        startTimeStamp?: string;
    };
    transData: {
        id: string;
        currency: string;
        desc?: string;
        timestamp?: string;
        jackpots?: {
            pjsId: string;
            controllerId: string;
            sharedJackpot: boolean;
            contributionAmount: number;
        }[];
        fundingSources: {
            type: "money" | "freeSpin" | "externalFreeSpin";
            value: number;
            extraProps?: {
                remainingSpins?: number;
                bonusInstanceId?: string;
            };
        }[];
        transExtraData?: any;
    };
};
type IWagerResponse = IV2GamePlayResult & {
    transData: {
        id: string;
        timestamp: string;
        igpTransId: string;
        igpGameCycleId: string;
    };
    balanceData: IBalanceData;
    messages?: (IMessageV1 & IMessageV2)[];
};
type IResultRequest = IV2GamePlayRequest & {
    gameCycleData: {
        id: string;
        gameId: string;
    };
    gameCycleFinishData?: {
        endTimestamp?: string;
    };
    transData?: {
        id: string;
        currency: string;
        desc?: string;
        timestamp?: string;
        jackpots?: {
            pjsId: string;
            controllerId: string;
            sharedJackpot: boolean;
            awardAmount: number;
        }[];
        payoutTargets: {
            type: "money";
            value: number;
        }[];
        transExtraData?: any;
    };
};
type IResultResponse = IV2GamePlayResult & {
    transData: {
        id: string;
        timestamp: string;
        igpTransId: string;
        igpGameCycleId: string;
    };
    balanceData: IBalanceData;
    messages?: (IMessageV1 & IMessageV2)[];
};

type IBalanceRequest = IV2GamePlayRequest;
type IBalanceResponse = IV2GamePlayResult & {
    balanceData: IBalanceData;
};

type ICancelRequest = IV2GamePlayRequest & {
    gameCycleData: {
        id: string;
        gameId: string;
    };
    cancelData: {
        id: string;
        originalId: string;
        desc?: string;
        timestamp?: string;
    };
};
type ICancelResponse = IV2GamePlayResult & {
    cancelData: {
        id: string;
        timestamp: string;
        originalId: string;
        igpTransId: string;
    };
    balanceData: IBalanceData;
    messages?: any[];
};
type IRealityCheckRequest = {
    _meta: IMeta;
    skinId: string;
    playerId: string;
    secureToken: string;
    userAction: "reset" | "stopgaming";
};
type IRealityCheckResponse = {
    regulationTypeData: {
        regulationCommand: "RealityCheckDialogResponseAck";
    };
};

type ICloseRoundBody = {
    gsId: string;
    gpId: string;
    requestId: string;
    command: "PTC_ResolveGameCycle";
    data: {
        playerId: string;
        skinId: string;
        gameCycleId: string;
        gameCycleFinishDateTime: string;
        brokenGameId: string;
        refunded: boolean;
    };
};
type ICloseRoundResponse = {
    gsId: string;
    gpId: string;
    requestId: string;
    errorCode?: string;
    errorMsg?: string;
    command: "PTC_ResolveGameCycleAck";
};
type IMessageV1 = {
    msgType: "Error" | "Message";
    accountMsg: string;
    contentType?: "text" | "HTML" | "other";
    extraData?: any;
};

type IMessageV2 = {
    type: "error" | "message";
    msg: string;
    extraData?: any;
};
type IErrorTag = "fatal" | "retriable" | "noDisplay";

type ILogoutParams = {
    skinId: string;
    playerId: string;
    secureToken: string;
    _meta: IMeta;
};
type ILogoutResponse = {
    logoutData: {
        command: "LogoutAck";
    };
};
type IGetGamesBody = {
    request: {
        data: any;
        command: "TPI_getGameList";
        requestId: string;
        igpId: string;
        rgsId: string;
    };
};
type IPaytable = {
    paytableId: string;
    paytableTitle: string;
    paytableDesc: string;
    minPaybackPct: number;
    maxPaybackPct: number;
    volatilityIndex?: number;
    confidenceInterval?: number;
};
type IGetGamesResponse = {
    response: {
        rgsId: string;
        igpId: string;
        requestId: string;
        command: "TPI_gameList";
        data: {
            gameId?: string;
            brandId?: string;
            gameArray: {
                gameId: string;
                gameTitle: string;
                gameDesc: string;
                gameType: "liveGame" | "lottery" | "poker" | "spinningReel" | "sportsBetting" | "tableGame" | "videoPoker" | "other";
                mfgCode: string;
                themeId: string;
                packageId: string;
                packageVersion: string;
                releaseNum?: string;
                paytableArray: IPaytable[];
                skinArray: {
                    brandId: string;
                    skinId: string;
                }[];
                channelArray: {
                    channelType: "desktop" | "mobile" | "tablet" | "retail" | "mixedReality";
                    presentType: "HTML5" | "FLASH10";
                    imageURL?: string;
                }[];
                localeArray: {
                    localeCode: string;
                    localeDefault?: boolean;
                }[];
                jurisdictionArray: {
                    jurisdictionCode: string;
                    approvalId?: string;
                }[];
                currencyArray: {
                    currencyCode: string;
                }[];
                parameterArray: {
                    paramId: string;
                    paramTitle: string;
                    paramDesc: string;
                    paramRequired: boolean;
                    paramDefault: string;
                }[];
                controllerLinkArray?: [];
                configSchema: string;
                configHash: string;
                PTC_defaultConfig: string;
            }[];
        };
    };
};
type IGetGameConfigurationParams = {
    _meta: IMeta;
    secureToken: string;
    playerId: string;
    skinId: string;
    currency: string;
    gameDocumentId?: string;
    gameId: string;
};
type IGetGameConfigurationResponse = {
    playerId: string;
    currency: string;
    data: {
        currencyMultiplier: number;
        baseCurrency: string;
        configData: any;
    };
};

interface IConfig {
    passphrase: string;
    url: string;
    key: string;
    cert: string;
    timeout?: number;
    gsId: string;
    mfgCode: string;
    gameVariants?: Record<string, IPaytable[]>;
}

const moneyFromPlaytech = (number: number, currency: string) => {
    return number / getCurrencyMultiplier(currency);
};

const moneyToPlaytech = (number: number, currency: string) => {
    return Math.round(number * getCurrencyMultiplier(currency));
};

const getCurrencyMultiplier = (currency: string) => {
    if (decimals[currency] === undefined) throw new Exception("Currency not supported by Playtech Wallet Adapter", {data: {currency}});
    return Math.pow(10, decimals[currency]!);
};

const messagesToPopups = (messages: (IMessageV1 & IMessageV2)[], errorTags: IErrorTag[], errorCode?: string): IExceptionPopup[] | undefined => {
    const popups: IExceptionPopup[] = [];
    if (errorTags.includes("noDisplay")) return [];
    if (messages.length === 0 && errorTags.includes("fatal")) {
        return [{title: "errorTitle", message: "transactionFailedMessage", buttons: [{label: "close", action: "exit"}]}];
    } else if (messages.length === 0) {
        return undefined;
    }
    for (let i = 0; i < messages.length; i++) {
        const isError = messages[i].type === "error" || messages[i].msgType === "Error";
        const title = isError ? "errorTitle" : undefined;
        const message = messages[i].accountMsg || messages[i].msg;
        const data = messages[i].extraData;
        const isLast = i == messages.length - 1;
        const closeButton: IExceptionPopupButton = {label: "close", action: "close", data};
        const exitButton: IExceptionPopupButton = {label: "close", action: "exit", data};
        let buttons = [isLast && errorTags.includes("fatal") ? exitButton : closeButton];

        if (errorCode === "ERR2210") {
            buttons = [
                {label: "stop", action: "walletMessage", data: {type: "realityCheck", choice: "stopgaming"}},
                {label: "continue", action: "walletMessage", data: {type: "realityCheck", choice: "reset"}},
            ];
        }
        popups.push({title, message, buttons});
    }
    return popups;
};

const configSchema = (url: string) => ({
    definitions: {},
    id: url,
    description: "Our system dynamically adjust available bets based on the ranges defined by game math based on values specfied in the form",
    properties: {
        defaultBet: {
            title: "Default Bet (in currency)",
            description: "Default bet will be set to closest available bet lower then specified value in currency",
            default: 1,
            minimum: 0,
            type: ["number", "null"],
        },
        minBet: {
            title: "Min bet (bet range cutoff treshold in currency)",
            description: "Available game bets lower than specified min bet will be eliminated",
            type: ["number", "null"],
        },
        maxBet: {
            title: "Max bet (bet range cutoff treshold in currency)",
            description: "Available game bets greater than specified max bet will be eliminated",
            type: ["number", "null"],
        },
        maxBonusBet: {
            title: "Max bonus bet (bet range cutoff treshold in currency)",
            description: "Available bonus game bets (ante, buy bonus etc.) greater than specified max bonus bet will be eliminated (if not specified then 'Max bet' is applied to bonus bets too)",
            type: ["number", "null"],
        },
        maxExposure: {
            title: "Max exposure (bet range cutoff treshold in currency)",
            description: "Available game bets which can generate wins greater than specified max exposure (based on thoretical max win) will be eliminated",
            type: ["number", "null"],
        },
    },
});

const gameVariantSeparator = "__";

const defaultConfig = {minBet: 0.01, maxBet: 10000, maxExposure: 10000000, defaultBet: 1};

function transformUrl(urlFromLaunch: string, urlFromAutenticate?: string): string | undefined {
    const getFromUrl = "[get-from-url]";
    if (urlFromAutenticate && urlFromAutenticate.includes(getFromUrl)) {
        let baseUrl = urlFromLaunch;
        if (baseUrl.includes("?")) baseUrl = urlFromLaunch.slice(0, urlFromLaunch.indexOf("?"));
        return urlFromAutenticate.replace(getFromUrl, baseUrl);
    }
    if (urlFromLaunch) return urlFromLaunch;
    return urlFromAutenticate;
}

export class PlaytechWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    cipher!: Cipher;
    agent!: Agent;

    async init(wallet: string, api: Express, path: string, config: IConfig, whitelistedIps?: string[]) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(`${this.config.gsId}_${this.config.mfgCode}_${this.config.passphrase}`, this.wallet);
        this.agent = new Agent({
            connect: {
                keepAlive: true,
                key: this.config.key,
                cert: this.config.cert,
                passphrase: this.config.passphrase,
                rejectUnauthorized: true,
            },
        });

        api.get(path + "/launch", async (req: Request<unknown, unknown, unknown, ILaunchParams>, res) => {
            const operator = /*req.query.licenseeid || */ "playtech";
            const brand = req.query.skinid;
            const lobbyUrl = req.query.backurl;
            const nativeId = req.query.playerid;
            const depositUrl = req.query.cashierurl;
            const secureToken = req.query.token;
            const historyUrl = req.query.gamehistoryurl;
            const refreshUrl = (req.query.crosslaunchurl || "").replace("[game]", req.query.imsgame);
            const [language] = req.query.language.toLowerCase().split("-");
            const mode = req.query.real === "0" ? "fun" : "real";
            const localeCode = req.query.language;
            const jurisdiction = req.query.jurisdiction;
            const clientPlatform = req.query.clientplatform;
            const clientType = req.query.clienttype;
            const gameId = req.query.game;
            const integration = req.query.integration;
            const [game, variant] = req.query.game.split(gameVariantSeparator);

            let key;
            if (mode === "real") {
                key = this.cipher.encrypt(JSON.stringify({gameId, variant, clientType, clientPlatform, secureToken, brand, localeCode, nativeId, jurisdiction, depositUrl, historyUrl, lobbyUrl}));
            } else {
                key = `${nativeId}:::${jurisdiction ? jurisdiction.toLowerCase() : ""}`;
            }

            const launchUrl = await launch(mode, {wallet, operator, language, game, key, refreshUrl, integration} as IParamsReal, req);
            res.redirect(launchUrl);
        });

        api.get(path + "/dgh", async (req: Request<unknown, unknown, unknown, IDetailedGameHistory>, res) => {
            const roundId = req.query.gameCycleId;
            const [game] = req.query.gameId.split(gameVariantSeparator);
            const [language] = req.query.languageCode.toLowerCase().split("-");
            const operator = "playtech";
            const launchUrl = await launch("replay", {roundId, game, operator, language}, req);
            res.redirect(launchUrl);
        });

        api.post(path + "/close-round", ipFilter(whitelistedIps), async (req: Request<unknown, unknown, ICloseRoundBody>, res: Response<ICloseRoundResponse>) => {
            const gsId = req.body.gsId;
            const gpId = req.body.gpId;
            const roundId = req.body.data.gameCycleId;
            const cancelTransactions = req.body.data.refunded;
            const status = cancelTransactions ? "cancelled" : "finished";
            if (cancelTransactions) {
                await Transaction.update({roundId, type: "withdraw"}, {status: "cancelled", cancelledAt: new Date()});
            }
            const body = JSON.stringify({roundId, status});
            await fetchAndParse(`${getServiceUrl("rgs")}/api/closeRound/`, {method: "POST", body, headers: {"Content-Type": "application/json"}});

            res.json({gsId, gpId, command: "PTC_ResolveGameCycleAck", requestId: v4()});
        });

        api.get(path + "/config-schema.json", async (req: Request, res: Response) => {
            res.json(configSchema(process.env.URL + path + "/config-schema.json"));
        });

        api.post(path + "/tpi", async (req: Request<unknown, unknown, IGetGamesBody>, res: Response<IGetGamesResponse>) => {
            const igpId = req.body.request.igpId;
            const rgsId = req.body.request.rgsId;
            const gamesWithVariant: [Game, IPaytable][] = [];
            for (const [game, paytables] of Object.entries(this.config.gameVariants || {})) {
                const item = await Game.findOneBy({game});
                if (!item) continue;
                for (const paytable of paytables) {
                    gamesWithVariant.push([item, paytable]);
                }
            }

            const typeMapping = {live: "liveGame", lottery: "lottery", poker: "poker", slot: "spinningReel", tableGame: "tableGame", videoPoker: "videoPoker", other: "other"};
            const getGameCode = (game: string, variant: string) => (variant === "default" ? game : game + gameVariantSeparator + variant);
            const response: IGetGamesResponse = {
                response: {
                    rgsId,
                    igpId,
                    command: "TPI_gameList",
                    requestId: v4(),
                    data: {
                        gameArray: gamesWithVariant.map(([item, paytable]) => ({
                            gameId: `${this.config.mfgCode}_${getGameCode(item.game, paytable.paytableId)}`,
                            gameTitle: (item.title || `${this.config.mfgCode}_${item.game}`) + ` (${paytable.paytableId})`,
                            gameDesc: `${this.config.mfgCode}_${item.game} Description`,
                            themeId: `${this.config.mfgCode}_${item.game}`,
                            packageId: `${this.config.mfgCode}_${item.game}`,
                            mfgCode: this.config.mfgCode,
                            packageVersion: "1.0.0",
                            gameType: (item.type && typeMapping[item.type]) || ("spinningReel" as any),
                            configSchema: process.env.URL + path + "/config-schema.json",
                            configHash: createHash("sha1")
                                .update(JSON.stringify(configSchema(process.env.URL + path + "/config-schema.json")))
                                .digest("hex"),
                            channelArray: [
                                {channelType: "desktop", presentType: "HTML5"},
                                {channelType: "mobile", presentType: "HTML5"},
                            ],
                            paytableArray: [paytable],
                            currencyArray: Object.keys(decimals).map(currency => ({currencyCode: currency.toUpperCase()})),
                            parameterArray: [{paramId: "gameCode", paramTitle: "Game code", paramDesc: "Game code description", paramDefault: getGameCode(item.game, paytable.paytableId), paramRequired: true}],
                            PTC_defaultConfig: JSON.stringify(defaultConfig),
                            jurisdictionArray: [],
                            skinArray: [],
                            localeArray: [],
                        })),
                    },
                },
            };
            res.json(response);
        });

        api.get(path + "/healthcheck", ipFilter(whitelistedIps), async (_, res) => {
            res.json({status: "ok"});
        });
    }

    private async fetch<IParams, IResponse>(path: string, params: IParams, retry: number, sessionId?: string, roundId?: string): Promise<IResponse> {
        do {
            const body = params ? JSON.stringify(params) : undefined;
            const headers: Record<string, string> = {"Content-Type": "application/json"};
            let json;
            let text;
            const url = `${this.config.url}${path}`;
            try {
                const response = await fetch(url + "?t=" + Date.now(), {
                    dispatcher: this.agent,
                    method: "POST",
                    body,
                    headers,
                    timeout: (this.config.timeout || 30) * 1000,
                });
                text = await response.text();
                json = JSON.parse(text);
            } catch (e) {
                if (retry === 0) {
                    throw new Exception("Couldn't fetch from wallet", {data: {error: e}});
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text});
            }
            if (json?.errorCode) {
                const retriable = json.errorTags.includes("retriable");
                const endSession = json.errorTags.includes("fatal") && !!sessionId;
                const cancelable = json.errorTags.includes("cancel");

                if (endSession) {
                    await proxy.endActiveSession("error", sessionId);
                }
                if (!retriable) {
                    let code = errorCodes.TRANSACTION_FAILED;
                    if (json.errorCode === "ERR025") {
                        code = errorCodes.INSUFFICIENT_FUNDS;
                    } else if (json.errorCode === "ERR1022") {
                        code = errorCodes.TRANSACTION_NOT_FOUND;
                    } else if (["ERR1030", "ERR1031", "ERR004", "ERR034", "ERR1022"].includes(json.errorCode)) {
                        code = errorCodes.CLOSE_ROUND;
                    } else if (cancelable) {
                        code = errorCodes.UNKNOWN;
                    }

                    if (["ERR004", "ERR1016", "ERR029", "ERR1024, ERR1026", "ERR1034"].includes(json.errorCode)) {
                        const content = `Unexpected error occurred in Playtech Wallet Adapter.<br/>Error code: ${json.errorCode}<br/>Please refer to <a href="https://pop-playtech.readme.io/docs/error-codes#general-errors">docs</a> and resolve the issue.<br/>RoundId: ${roundId}`;
                        sendAlert("Playtech Wallet Adapter Error", content);
                    }
                    const popups = messagesToPopups(json.messages || json.messageArray || [], json.errorTags, json.errorCode);
                    throw new Exception("Transaction failed", {status: StatusCode.BAD_REQUEST, code, popups});
                }
            } else if (json) {
                return json;
            }
        } while (--retry >= 0);
        throw new Exception("Couldn't parse the request");
    }

    async authenticate(key: string): Promise<IWalletAuthenticate> {
        const {clientType, clientPlatform, secureToken, brand, localeCode, nativeId, jurisdiction, gameId, variant, depositUrl, historyUrl, lobbyUrl} = JSON.parse(this.cipher.decrypt(key));
        const [, country] = localeCode.toLowerCase().split("-");

        const params: IVerifyPlayerSessionRequest = {
            _meta: {
                gpId: "tequity",
                gsId: this.config.gsId,
                clientPlatform,
                clientType,
                apiFeatures: ["errorTags", "singleSession"],
                get requestId() {
                    return v4();
                },
            },
            localeCode,
            gameId,
            secureToken,
            includeUrls: true,
            playerId: nativeId,
            skinId: brand,
        };
        const verifyPlayer = await this.fetch<IVerifyPlayerSessionRequest, IVerifyPlayerSessionResponse>("/v1/player/verifyplayersession", params, 2);
        const currency = verifyPlayer.accountBalance.currencyCode.toLowerCase();
        const balance = moneyFromPlaytech(verifyPlayer.accountBalance.balanceArray.find(item => item.balanceType === "cashable")!.balanceAmt, currency);
        const token = verifyPlayer.secureToken;
        const urls = verifyPlayer.urls;

        const params2: IGetGameConfigurationParams = {
            _meta: {
                gpId: "tequity",
                gsId: this.config.gsId,
                clientPlatform,
                clientType,
                apiFeatures: ["errorTags"],
                get requestId() {
                    return v4();
                },
            },
            currency: currency.toUpperCase(),
            gameId,
            secureToken: token,
            playerId: nativeId,
            skinId: brand,
        };
        const _meta = {gpId: "tequity", gsId: this.config.gsId, clientPlatform, clientType};
        const sessionData: ISessionData = {
            _meta,
            gameId,
            settings: {
                gameVariant: variant,
                depositUrl: transformUrl(depositUrl, urls?.cashier),
                historyUrl: transformUrl(historyUrl, urls?.history),
                lobbyUrl: transformUrl(lobbyUrl, urls?.lobby),
            },
            betConfig: {...defaultConfig},
        };
        try {
            const gameConfiguration = await this.fetch<IGetGameConfigurationParams, IGetGameConfigurationResponse>("/v1/gamesession/getgameconfiguration", params2, 0);
            sessionData.currencyRate = gameConfiguration.data.currencyMultiplier || 1;
            if (gameConfiguration.data.configData) {
                const {minBet, maxBet, maxBonusBet, maxExposure, defaultBet} = gameConfiguration.data.configData;
                sessionData.betConfig = {minBet, maxBet, maxBonusBet, maxExposure, defaultBet};
            }
        } catch {
            logger.info("Game configuration failed, fallback to default config");
        }
        const maxBet = verifyPlayer.sessionData?.maxAllowedBetAmt && moneyFromPlaytech(verifyPlayer.sessionData.maxAllowedBetAmt, currency);
        if (maxBet != null) {
            sessionData.betConfig ||= {};
            sessionData.betConfig.maxBet = Math.min(maxBet, sessionData.betConfig?.maxBet || maxBet);
            sessionData.betConfig.maxBonusBet = Math.min(maxBet, sessionData.betConfig?.maxBonusBet || maxBet);
        }

        return {balance, currency, brand, country, nativeId, jurisdiction, token, sessionData};
    }

    async balance(player: Player, provider: string, game: string, session: ISession): Promise<IWalletBalance> {
        const params: IBalanceRequest = {
            get requestId() {
                return v4();
            },
            player: player.nativeId,
            casino: player.brand!,
            rgsId: this.config.gsId,
            token: session.token,
        };
        const res = await this.fetch<IBalanceRequest, IBalanceResponse>("/v2/gamesession/balance", params, 2, session.sessionId);
        const balance = moneyFromPlaytech(res.balanceData.balances.find(({type}) => type === "cashable")!.amount, player.currency);
        return {balance};
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession, originalSession: ISession | null): Promise<IWalletBalance> {
        const token = originalSession?.token || session.token;
        const params: ICancelRequest = {
            get requestId() {
                return v4();
            },
            player: player.nativeId,
            casino: player.brand!,
            rgsId: this.config.gsId,
            token,
            gameCycleData: {gameId: session.data.gameId, id: transaction.roundId},
            cancelData: {id: "cancel_" + transaction.transactionId, originalId: transaction.transactionId},
        };
        const res = await this.fetch<ICancelRequest, ICancelResponse>("/v2/gamesession/cancel", params, 3, session.sessionId, transaction.roundId);
        const balance = moneyFromPlaytech(res.balanceData.balances.find(({type}) => type === "cashable")!.amount, player.currency);
        return {balance};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession, originalSession: ISession | null): Promise<IWalletBalance> {
        const token = originalSession?.token || session.token;
        if (transaction.type === "withdraw") {
            const params: IWagerRequest = {
                player: player.nativeId,
                casino: player.brand!,
                rgsId: this.config.gsId,
                token,
                get requestId() {
                    return v4();
                },
                gameCycleData: {gameId: session.data.gameId, id: transaction.roundId},
                transData: {
                    id: transaction.transactionId,
                    currency: player.currency.toUpperCase(),
                    fundingSources: [{type: "money", value: moneyToPlaytech(transaction.amount, player.currency)}],
                },
            };
            const res = await this.fetch<IWagerRequest, IWagerResponse>("/v2/gamesession/wager", params, 0, session.sessionId, transaction.roundId);
            const popups = messagesToPopups(res.messages || [], []);
            const balance = moneyFromPlaytech(res.balanceData.balances.find(({type}) => type === "cashable")!.amount, player.currency);
            return {balance, popups};
        } else {
            const params: IResultRequest = {
                player: player.nativeId,
                casino: player.brand!,
                rgsId: this.config.gsId,
                token,
                get requestId() {
                    return v4();
                },
                gameCycleData: {gameId: session.data.gameId, id: transaction.roundId},
                transData:
                    transaction.amount > 0
                        ? {
                              id: transaction.transactionId,
                              currency: player.currency.toUpperCase(),
                              payoutTargets: [{type: "money", value: moneyToPlaytech(transaction.amount, player.currency)}],
                          }
                        : undefined,
                gameCycleFinishData: transaction.roundFinished ? {} : undefined,
            };
            const res = await this.fetch<IResultRequest, IResultResponse>("/v2/gamesession/result", params, 3, session.sessionId, transaction.roundId);
            const popups = messagesToPopups(res.messages || [], []);
            const balance = moneyFromPlaytech(res.balanceData.balances.find(({type}) => type === "cashable")!.amount, player.currency);
            return {balance, popups};
        }
    }

    async end(player: Player, reason: "expired" | "authenticate" | "error", session: ISession) {
        const params: ILogoutParams = {
            _meta: {
                gsId: session.data?._meta.gsId,
                gpId: session.data?._meta.gpId,
                apiFeatures: ["errorTags"],
                get requestId() {
                    return v4();
                },
            },
            skinId: player.brand!,
            playerId: player.nativeId,
            secureToken: session.token,
        };
        await this.fetch<ILogoutParams, ILogoutResponse>("/v1/player/logout", params, 2);
    }

    async message(player: Player, data: {type: "realityCheck"; choice: "reset" | "stopgaming"}, session: ISession): Promise<{action: IExceptionPopupButton["action"]}> {
        if (data.type === "realityCheck") {
            const params: IRealityCheckRequest = {
                _meta: {
                    gsId: session.data?._meta.gsId,
                    gpId: session.data?._meta.gpId,
                    clientPlatform: session.data?._meta.clientPlatform,
                    clientType: session.data?._meta.clientType,
                    apiFeatures: [],
                    get requestId() {
                        return v4();
                    },
                },
                playerId: player.nativeId,
                skinId: player.brand!,
                secureToken: session.token,
                userAction: data?.choice as any,
            };

            const res = await this.fetch<IRealityCheckRequest, IRealityCheckResponse>("/v1/gamesession/regulation/rc/realitycheckdialogresponse", params, 2);
            if (res.regulationTypeData.regulationCommand !== "RealityCheckDialogResponseAck") {
                throw new Exception("Reality check message failed");
            }
            return {action: data.choice === "stopgaming" ? "exit" : "close"};
        }
        throw new Exception("Unknown message");
    }
}

export default PlaytechWalletAdapter;
