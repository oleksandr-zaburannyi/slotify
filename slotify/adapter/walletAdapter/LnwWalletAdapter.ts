import {Express, Request, Response} from "express";
import * as xml2js from "xml2js";
import {v4} from "uuid";
import fetch from "@slotify/shared/lib/fetch";
import Cipher from "@slotify/shared/lib/Cipher";
import Exception, {IExceptionPopup, IExceptionPopupButton} from "@slotify/shared/lib/Exception";
import logger from "@slotify/shared/lib/logger";
import {StatusCode} from "@slotify/shared/lib/StatusCode";
import {sendAlert} from "@slotify/shared/lib/sendAlert";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Game} from "../db/model/Game";
import {Player} from "../db/model/Player";
import {IRegulatory, ITransactionData, Transaction} from "../db/model/Transaction";
import launch, {IParamsFun, IParamsReal} from "../route/launch";
import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletBalance, IWalletTransaction} from "./IWalletAdapter";
import {getAvailableBetsBulk, getCriticalFiles, getRgsCurrencies} from "../util/external";
import {lnwCurrencies} from "./lnw/LnwCurrencies";
import {errorCodes} from "./walletAdapter";
import {Session} from "../db/model/Session";
import {DateTime} from "../util/luxon";

type IConfig = {
    url: string;
    username: string;
    password: string;
    gpid: string;
    authUrl: string;
    creditApiUrl: string;
    creditApiClientId: string;
    creditApiClientSecret: string;
    ogsGameIdsMapping: Record<string, string>;
};

type IDevice = "desktop" | "mobile";

// TODO: improve this type to split malta and ukgc from common
type ILauncherQueryParams = {
    operatorid: string;
    gameid: string;
    sessionid: string;
    mode: "demo" | "real";
    lang: string;
    currency: string;
    device: IDevice;
    depositurl?: string;
    lobbyurl?: string;

    // Malta & UKGC params
    jurisdiction?: string;

    // Malta params
    realitycheck_mt_elapsed?: string;
    realitycheck_mt_limit?: string;

    // UKGC params
    realitycheck_uk_elapsed: string;
    realitycheck_uk_limit: string;
    realitycheck_uk_proceed?: string;
    realitycheck_uk_history: string;
    realitycheck_uk_autospin?: string;
    realitycheck_uk_exit?: string;
};

type IMessageOption = {
    $: {
        id: string;
        action?: string;
    };
    _: string;
};
type IMessage = {
    $: {
        id: string;
        nogslang: string;
    };
    TYPE?: [string];
    TITLE: [string];
    TEXT: [string];
    OPTIONS: {
        $: {
            count: string;
        };
        OPTION: IMessageOption[];
    }[];
}[];

type ILnwApiRequest = "getaccount" | "getbalance" | "wager" | "result" | "rollback";

type IWalletCommonRequest = {
    sessionid: string;
    currency: string;
    gpgameid: string;
    opid: string;
    device: IDevice;
    playerip?: string;
};

type IWalletCommonResponse = {
    RSP: {
        $: {request: string; rc: number};
        APIVERSION: [number];
    };
};

type IMessageResponse = {
    RSP: {
        MESSAGE: IMessage;
    };
};

type IFreeRound = {
    VERSION: [number];
    CAMPAIGNID: [string];
    ACTIVATIONID: [string];
    ENDDATE: [string];
    TOTALWIN: [number];
    CAMPAIGNVALUE: [number];
    REJECTABLE: [boolean];
    OPTIONS: {
        OPTION: {
            BETLEVEL: [number];
            TOTALROUNDS: [number];
            REMAININGROUNDS: [number];
            FEATURE: [string];
        }[];
    }[];
    MESSAGES?: {
        MESSAGE: {
            TYPE: [string];
            TEXT: [string];
        }[];
    }[];
};

type IGetAccountRequest = {
    lang: string;
} & IWalletCommonRequest;

type IGetAccountResponse = {
    RSP: {
        ACCOUNTID: [string];
        COUNTRY: [string];
        CURRENCY: [string];
        SESSIONID: [string];
        PLAYERMAXSTAKE?: [number];
        PROMOTIONS: {
            FREEROUNDS: IFreeRound[];
        }[];
    };
} & IWalletCommonResponse &
    IMessageResponse;

type IGetBalanceRequest = {
    accountid: string;
} & IWalletCommonRequest;

type IGetBalanceResponse = {
    RSP: {
        BALANCE: [number];
        CURRENCY: [string];
        SESSIONID: [string];
        REALBALANCE?: [number];
        BONUSBALANCE?: [number];
    };
} & IWalletCommonResponse &
    IMessageResponse;

type IWagerRequest = {
    accountid: string;
    betamount: number;
    roundid: string;
    transactionid: string;
    jpcamount?: number;
    jpcbaseamount?: number;
} & IWalletCommonRequest;

type IWagerResponse = {
    RSP: {
        BALANCE: [number];
        CURRENCY: [string];
        REALMONEYBET: [string];
        BONUSMONEYBET: [string];
        SESSIONID: [string];
    };
} & IWalletCommonResponse &
    IMessageResponse;

type IGameDetails =
    | {
          slotMachines: {result: string};
      }
    | {
          gameType: "gambles";
          gameDetails: {details: {picked: string; displayed: string}}[];
      }
    | {
          blackjack: {
              maxPlayers: string;
              tableCards: string;
              tableid: string;
              playerCards: string;
              playerPosition: string;
              result: string;
              r_valor: string;
          };
      }
    | {
          roulette: {
              desc: string;
              number: string;
              color: string;
              r_valor: string;
          };
      };

type IResultRequest = {
    accountid: string;
    gamedetails?: IGameDetails;
    gamestatus: "pending" | "completed";
    roundid: string;
    transactionid: string;
    wonamount: number;
} & IWalletCommonRequest;

type IResultResponse = {
    RSP: {
        BALANCE: [number];
        CURRENCY: [string];
        SESSIONID: [string];
    };
} & IWalletCommonResponse &
    IMessageResponse;

type IRollbackRequest = {
    accountid: string;
    gamestatus: "pending" | "completed";
    rollbackamount: number;
    roundid: string;
    transactionid: string;
} & IWalletCommonRequest;

type IRollbackResponse = {
    RSP: {
        BALANCE: [number];
        CURRENCY: [string];
        SESSIONID: [string];
    };
} & IWalletCommonResponse;

type IServiceAPICommonRequest = {
    apiversion: string;
    loginname: string;
    password: string;
    request: "getroundid" | "getrounds" | "getbetlevels" | "getcriticalfiles";
};

type IGetRoundIdRequest = {
    request: "getroundid";
    opids: string;
    roundid: string;
} & IServiceAPICommonRequest;

type IGetRoundsRequest = {
    request: "getrounds";
    accountid: string;
    start: string;
    opids: string;
    gpgameid?: string;
} & IServiceAPICommonRequest;

type IGetBetLevelsRequest = {
    request: "getbetlevels";
    opids: string;
    gpgameid: string;
} & IServiceAPICommonRequest;

type ICriticalFilesRequest = {
    request: "getcriticalfiles";
    gpgameids: string;
} & IServiceAPICommonRequest;

type ICriticalFilesResponse = {
    ogsgameid: string;
    filepath: string;
    filename: string;
    checksum: string;
};

type IInfinityChecksumRequest = {
    apiversion: string;
    request: "getchecksumreport";
    loginname: string;
    password: string;
    opid: string;
    jurisdiction: string;
    algorithmttype: "NGI_SHA1" | "NGI_SHA256";
};

type IInfinityChecksumResponse = {
    componentId: string;
    componentType: "NGI_software";
    metadata: {
        game: {
            name: string;
            gpgameid: string;
        };
    };
    verifyState: "NGI_complete" | "NGI_error";
    verifyResult: string;
};

type IServiceAPIParams = IGetRoundIdRequest | IGetRoundsRequest | IGetBetLevelsRequest | ICriticalFilesRequest | IInfinityChecksumRequest;

type IRoundHistoryData = {
    roundId: string;
    roundIdBigInt: string;
    createdAt: Date;
    brand: string;
    playerId: string;
    game: string;
    gameTitle: string;
    gameStatus: string;
    totalBet: string;
    totalWin: string;
    currency: string;
};

type IRoundHistoryResponse = {
    $: {
        id: string;
        created: string;
    };
    ACCOUNTID: string;
    OPID: string;
    GAMENAME: string;
    GPGAMEID: string;
    GAMESTATUS: string;
    TOTALBET: string;
    TOTALWIN: string;
    CURRENCY: string;
    GAMEDATA: {
        $: {format: "external"};
        _: string;
    };
};

type IRoundsHistoryResponse = {
    ROUNDS: {
        $?: {limit: boolean};
        ROUND: IRoundHistoryResponse[];
    };
};

const apiVersion = "1.5";
const operator = "lnw";

export class LnwWalletAdapter implements IWalletAdapter {
    wallet!: string;
    config!: IConfig;
    cipher!: Cipher;

    async init(wallet: string, api: Express, path: string, config: any) {
        this.wallet = wallet;
        this.config = config;
        this.cipher = new Cipher(this.config.username + ":" + this.config.password, this.wallet);

        api.get(`${path}/service-api`, async (req: Request, res: Response) => {
            try {
                const queryParams = req.query as IServiceAPIParams;
                const {request, loginname: username, password} = queryParams;

                if (username !== this.config.username || password !== this.config.password) {
                    throw new Exception("Unauthorized call");
                }

                const builder = new xml2js.Builder({rootName: "RSP", xmldec: {version: "1.0", encoding: "UTF-8"}});
                const response = {$: {request, rc: 0}, APIVERSION: apiVersion};

                if (request === "getroundid") {
                    if (!queryParams.roundid || !queryParams.opids) {
                        throw new Exception("Missing query params: roundid, opids");
                    }

                    const roundIdBigInt = queryParams.roundid;
                    const operatorIds = queryParams.opids.split(",");
                    const result = await this.getRoundHistory(roundIdBigInt, operatorIds);
                    const transaction = await getConnection("replica")
                        .manager.createQueryBuilder(Transaction, "transaction")
                        .select("transaction.roundId")
                        .where("transaction.data->>'roundIdBigInt' = :roundIdBigInt", {roundIdBigInt})
                        .limit(1)
                        .getOne();

                    if (!result || !transaction?.roundId) {
                        res.send(builder.buildObject({...response, ROUNDS: {}}));
                        return;
                    }

                    const roundId = transaction.roundId;
                    const roundDetails: IRoundHistoryResponse[] = [
                        {
                            $: {id: result.roundIdBigInt, created: result.createdAt.toISOString()},
                            ACCOUNTID: result.playerId,
                            OPID: result.brand,
                            GAMENAME: result.gameTitle ?? result.game,
                            GPGAMEID: result.game,
                            GAMESTATUS: result.gameStatus,
                            TOTALBET: result.totalBet,
                            TOTALWIN: result.totalWin,
                            CURRENCY: result.currency.toUpperCase(),
                            GAMEDATA: {
                                $: {format: "external"},
                                _: await launch("replay", {roundId, language: "en", operator: result.brand, game: result.game}, req),
                            },
                        },
                    ];

                    const rounds: IRoundsHistoryResponse = {
                        ROUNDS: {
                            ROUND: roundDetails,
                        },
                    };

                    res.send(
                        builder.buildObject({
                            ...response,
                            ...rounds,
                        }),
                    );
                    return;
                } else if (request === "getrounds") {
                    if (!queryParams.accountid || !queryParams.start || !queryParams.opids) {
                        throw new Exception("Missing query params: accountid, start, opids");
                    }

                    const roundsLimit = 100;
                    const {accountid: playerId, start, gpgameid: game, opids} = queryParams;
                    const operatorIds = opids.split(",");
                    const results = await this.getPlayerRoundsHistory(playerId, start, operatorIds, game, roundsLimit);

                    if (!results) {
                        res.send(builder.buildObject({...response, ROUNDS: {}}));
                        return;
                    }

                    const roundsDetails: IRoundHistoryResponse[] = await Promise.all(
                        results.map(async round => ({
                            $: {id: round.roundIdBigInt, created: round.createdAt.toISOString()},
                            ACCOUNTID: round.playerId,
                            OPID: round.brand,
                            GAMENAME: round.gameTitle ?? round.game,
                            GPGAMEID: round.game,
                            GAMESTATUS: round.gameStatus,
                            TOTALBET: round.totalBet,
                            TOTALWIN: round.totalWin,
                            CURRENCY: round.currency.toUpperCase(),
                            GAMEDATA: {
                                $: {format: "external"},
                                _: await launch("replay", {roundId: round.roundId, language: "en", operator: round.brand, game: round.game}, req),
                            },
                        })),
                    );

                    const rounds: IRoundsHistoryResponse = {
                        ROUNDS: {
                            $: roundsDetails.length > roundsLimit ? {limit: true} : undefined,
                            ROUND: roundsDetails,
                        },
                    };

                    res.send(
                        builder.buildObject({
                            ...response,
                            ...rounds,
                        }),
                    );
                    return;
                } else if (request === "getbetlevels") {
                    const game = req.query.gpgameid?.toString();

                    if (!game) {
                        throw new Exception("Missing query params: gpgameid");
                    }

                    const rgsCurrencies = await getRgsCurrencies();
                    const availableCurrencies = lnwCurrencies.filter(currency => rgsCurrencies.includes(currency));
                    const {provider} = await Game.get(game);
                    const betlevels = await getAvailableBetsBulk({
                        wallet: this.wallet,
                        operator,
                        brand: req.query.opid?.toString(),
                        provider,
                        games: [game],
                        currencies: availableCurrencies,
                    });

                    if (!betlevels) {
                        res.send(builder.buildObject({...response, GAMES: {}}));
                        return;
                    }

                    const betLevelsList = [];
                    for (const currency in betlevels[game]) {
                        const values = betlevels[game][currency].toString();

                        if (!values) continue;

                        betLevelsList.push({$: {currency: currency.toUpperCase(), values}});
                    }

                    res.send(
                        builder.buildObject({
                            ...response,
                            GAMES: {
                                GAME: {
                                    $: {gpgameid: game, playerchoice: 2, gamechoice: false},
                                    BETLEVELS: {
                                        BETLEVEL: betLevelsList,
                                    },
                                },
                            },
                        }),
                    );
                    return;
                } else if (request === "getcriticalfiles") {
                    if (!queryParams.gpgameids) {
                        throw new Exception("Missing query params: gpgameids");
                    }

                    const fromOgGameId = config.ogsGameIdsMapping;
                    const toOgGameId = Object.fromEntries(Object.entries(config.ogsGameIdsMapping).map(([k, v]) => [v, k]));

                    const games = queryParams.gpgameids.split(",").map(ogsgameid => fromOgGameId[ogsgameid]);

                    const criticalFiles: ICriticalFilesResponse[] = [];
                    const criticalFilesList = await getCriticalFiles({games});
                    for (const {name, jurisdictions, loggedChecksum, component} of criticalFilesList.items) {
                        if (!jurisdictions?.length) {
                            continue;
                        }

                        const lastSlashPos = name.lastIndexOf("/");
                        const filepath = name.substring(0, lastSlashPos);
                        const filename = name.substring(lastSlashPos + 1);
                        criticalFiles.push({ogsgameid: toOgGameId[component], filepath, filename, checksum: loggedChecksum});
                    }

                    res.send({checksums: criticalFiles});
                    return;
                } else if (request === "getchecksumreport") {
                    if (!queryParams.jurisdiction) {
                        res.send(builder.buildObject({...response, request: "getchecksumreport", rc: 1008, msg: "jurisdiction param required"}));
                        return;
                    }
                    if (!queryParams.opid) {
                        res.send(builder.buildObject({...response, request: "getchecksumreport", rc: 1008, msg: "opid param required"}));
                        return;
                    }
                    if (queryParams.algorithmttype !== "NGI_SHA1") {
                        res.send(builder.buildObject({...response, request: "getchecksumreport", rc: 1009, msg: "Unsupported algorithm type"}));
                        return;
                    }

                    const toOgGameId = Object.fromEntries(Object.entries(config.ogsGameIdsMapping).map(([k, v]) => [v, k]));
                    const games = Object.values(config.ogsGameIdsMapping) as string[];

                    const criticalFiles: IInfinityChecksumResponse[] = [];
                    const criticalFilesList = await getCriticalFiles({games});

                    for (const {name, jurisdictions, declaredChecksum, loggedChecksum, component} of criticalFilesList.items) {
                        if (!jurisdictions?.length || !jurisdictions.includes(queryParams.jurisdiction)) {
                            continue;
                        }

                        let gameTitle = component;
                        try {
                            const {title} = await Game.get(component);
                            gameTitle = title || component;
                        } catch {
                            logger.warn(`Missing game metadata for ${component}`);
                        }

                        criticalFiles.push({
                            componentId: name,
                            componentType: "NGI_software",
                            metadata: {
                                game: {
                                    name: gameTitle,
                                    gpgameid: toOgGameId[component],
                                },
                            },
                            verifyState: declaredChecksum === loggedChecksum ? "NGI_complete" : "NGI_error",
                            verifyResult: loggedChecksum,
                        });
                    }

                    res.send({
                        RSP: {
                            request: "getchecksumreport",
                            rc: 0,
                            apiversion: apiVersion,
                            report: {
                                algorithmType: "NGI_SHA1",
                                componentResults: criticalFiles,
                            },
                        },
                    });
                    return;
                }

                throw new Exception("Unknown request type");
            } catch (err) {
                throw new Exception(`Something went wrong (err: ${(err as Error).message})`);
            }
        });

        api.get(`${path}/game`, async (req: Request<unknown, unknown, unknown, ILauncherQueryParams>, res: Response) => {
            const {
                operatorid: brand,
                gameid: game,
                sessionid,
                mode,
                lang: language,
                currency,
                device: channel,
                depositurl: depositUrl,
                lobbyurl: lobbyUrl,
                realitycheck_uk_history: historyUrl,
                realitycheck_uk_exit: customExit,
                realitycheck_uk_proceed: realityCheckContinueUrl,
                realitycheck_uk_autospin: startAutoplayUrl,
                ...extraParams
            } = req.query;
            const realityCheckIntervalInSeconds = req.query["realitycheck_mt_limit"] || req.query["realitycheck_uk_limit"];
            const realityCheckElapsedInSeconds = req.query["realitycheck_mt_elapsed"] || req.query["realitycheck_uk_elapsed"];
            const realityCheckInterval = realityCheckIntervalInSeconds ? parseInt(realityCheckIntervalInSeconds) / 60 : undefined;
            const realityCheckElapsed = realityCheckElapsedInSeconds ? parseInt(realityCheckElapsedInSeconds) / 60 : undefined;

            let launchUrl: string;
            if (mode === "demo") {
                const key = this.createDemoWalletPlayerKey(currency, req.query["jurisdiction"], brand);
                const launchData = {game, operator, language, lobbyUrl, depositUrl, realityCheckInterval, realityCheckElapsed, realityCheckContinueUrl, historyUrl, startAutoplayUrl, customExit, channel, key} as IParamsFun;
                launchUrl = await launch("fun", launchData, req);
            } else {
                const key = this.cipher.encrypt(JSON.stringify({brand, sessionid, channel, language, currency, jurisdiction: req.query["jurisdiction"], ...extraParams, salt: Date.now()}));
                const launchData = {game, operator, language, lobbyUrl, depositUrl, realityCheckInterval, realityCheckElapsed, realityCheckContinueUrl, historyUrl, startAutoplayUrl, customExit, channel, wallet, key} as IParamsReal;
                launchUrl = await launch("real", launchData, req);
            }

            res.redirect(launchUrl);
        });
    }

    async authenticate(encryptedUrlKey: string, operator: string, provider: string, game: string): Promise<IWalletAuthenticate> {
        const {brand, sessionid, channel, language, currency, jurisdiction} = JSON.parse(this.cipher.decrypt(encryptedUrlKey));

        const {
            RSP: {
                ACCOUNTID: [nativeId],
                SESSIONID: [token],
                PLAYERMAXSTAKE: playerMaxStake,
                MESSAGE: message,
                PROMOTIONS: promotions,
            },
        } = await this.fetch<IGetAccountRequest, IGetAccountResponse>(
            "getaccount",
            {
                currency,
                device: channel,
                gpgameid: game,
                opid: brand,
                sessionid,
                lang: language,
            },
            0,
        );

        const session = await getConnection("primary")
            .manager.createQueryBuilder(Session, "session")
            .select("player.brand", "playerBrand")
            .leftJoin(Player, "player", "player.id = session.playerId")
            .where(`"nativeId" = :nativeId`, {nativeId})
            .andWhere(`token = :token`, {token})
            .limit(1)
            .getRawOne();
        if (session) {
            if (session.playerBrand !== brand) {
                throw new Exception("This session does not belong to current brand", {
                    data: {
                        sessionid,
                        nativeId,
                        playerBrand: session.playerBrand,
                        requestedBrand: brand,
                    },
                });
            }
        }

        const {
            RSP: {
                BALANCE: [balance],
            },
        } = await this.fetch<IGetBalanceRequest, IGetBalanceResponse>(
            "getbalance",
            {
                sessionid: token,
                opid: brand,
                gpgameid: game,
                device: channel,
                currency: currency.toUpperCase(),
                accountid: nativeId,
                ...(promotions?.[0]?.FREEROUNDS?.[0]
                    ? {
                          type: "freerounds",
                          campaignid: promotions?.[0]?.FREEROUNDS?.[0].CAMPAIGNID?.[0],
                          activationid: promotions?.[0]?.FREEROUNDS?.[0].ACTIVATIONID?.[0],
                      }
                    : null),
            },
            2,
        );

        const maxBet = jurisdiction === "uk" && playerMaxStake && playerMaxStake[0] > 5 ? 2 : playerMaxStake?.[0];
        const popups = [...(this.messageToPopup(message) ?? []), ...(this.freeRoundsToPopup(promotions?.[0]?.FREEROUNDS) ?? [])];

        return {
            nativeId,
            brand,
            token,
            balance,
            currency: currency.toLocaleLowerCase(),
            jurisdiction,
            sessionData: {
                betConfig: {
                    maxBet,
                },
                sessionid,
                channel,
                language,
            },
            popups,
        };
    }

    async balance(player: Player, provider: string, game: string, session: ISession): Promise<IWalletBalance> {
        const freeRounds = session.data.freeRounds;
        const {
            RSP: {
                BALANCE: [balance],
                MESSAGE: message,
            },
        } = await this.fetch<IGetBalanceRequest, IGetBalanceResponse>(
            "getbalance",
            {
                sessionid: session.token,
                opid: player.brand!,
                gpgameid: game,
                device: session.data.channel,
                currency: player.currency.toUpperCase(),
                accountid: player.nativeId,
                ...(freeRounds
                    ? {
                          type: "freerounds",
                          campaignid: freeRounds.campaignId,
                          activationid: freeRounds.activationId,
                      }
                    : null),
            },
            2,
        );
        const popups = this.messageToPopup(message);
        return {balance, popups};
    }

    async transaction(player: Player, transaction: IWalletTransaction, session: ISession): Promise<IWalletBalance> {
        const freeRounds = session.data.freeRounds;
        const transactionData: ITransactionData = {
            roundIdBigInt: this.convertToDecimal(transaction.roundId),
            transactionIdBigInt: this.convertToDecimal(transaction.transactionId),
        };
        await Transaction.update({id: transaction.transactionId}, {data: transactionData});

        let freeRound: any;
        if (freeRounds && freeRounds.numberOfBets > 0) {
            freeRound = {
                type: "freerounds",
                campaignid: freeRounds.campaignId,
                activationid: freeRounds.activationId,
                promotionstatus: "pending",
            };
        }

        if (transaction.type === "withdraw") {
            const isSidebet = await this.isSidebet(transaction.roundId);
            let sidebet;

            if (isSidebet) {
                sidebet = {type: "sidebet"};
            }

            const {
                RSP: {
                    BALANCE: [balance],
                    MESSAGE: message,
                },
            } = await this.fetch<IWagerRequest, IWagerResponse>(
                "wager",
                {
                    device: (transaction.channel || session.data.channel || "desktop") as IDevice,
                    sessionid: session.token,
                    accountid: player.nativeId,
                    opid: player.brand!,
                    currency: player.currency.toUpperCase(),
                    gpgameid: transaction.game!,
                    betamount: transaction.amount,
                    roundid: transactionData.roundIdBigInt!,
                    transactionid: transactionData.transactionIdBigInt!,
                    ...(transaction.jackpotAmount ? {jpcamount: transaction.jackpotAmount, jpcbaseamount: transaction.jackpotAmount} : {}),
                    ...(freeRound || sidebet),
                },
                0,
            );
            const popups = this.messageToPopup(message);
            return {balance, popups};
        } else {
            if (transaction.category === "promo") {
                const authResponse = await fetch(`${this.config.authUrl}/auth/v1.0/authtoken`, {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${Buffer.from(`${this.config.creditApiClientId}:${this.config.creditApiClientSecret}`).toString("base64")}`,
                    },
                });
                const authDetails = await authResponse.json();

                const body = JSON.stringify({
                    gameDetail: {
                        gpGameId: transaction.game,
                        gpId: this.config.gpid,
                    },
                    player: {
                        accountId: player.nativeId,
                        opId: player.brand!,
                    },
                    transaction: {
                        transactionAmount: transaction.amount,
                        currency: player.currency.toUpperCase(),
                        transactionId: transaction.transactionId,
                        sourceId: transaction.campaignId,
                        sessionId: session.sessionId,
                        baseGameRoundId: transaction.roundId,
                    },
                });
                const response = await fetch(`${this.config.creditApiUrl}/papi/v1.1/credit`, {
                    headers: {
                        "Authorization": `${authDetails.token_type} ${authDetails.access_token}`,
                    },
                    body,
                });
                const {
                    player: {realbalance: balance},
                } = await response.json();

                return {balance};
            } else {
                let endOfFreeRoundsPopup: IExceptionPopup[] | undefined;
                if (freeRounds) {
                    const numberOfBets = --session.data.freeRounds.numberOfBets;
                    Session.update(
                        {sessionId: session.sessionId},
                        {
                            data: {
                                ...session.data,
                                freeRounds: {
                                    ...session.data.freeRounds,
                                    numberOfBets,
                                },
                            },
                        },
                    );
                    if (numberOfBets === 0) {
                        freeRound!.promotionstatus = "completed";
                        endOfFreeRoundsPopup = [
                            {
                                title: "lnw_freeBetsTitle",
                                message: "lnw_freeBetsEnded",
                                buttons: [{label: "close", action: "unfreezeBet", data: {isFreeBetRoundEnd: "true"}}],
                            },
                        ];
                    }
                }

                const gameDetails = await this.getGameDetails(transaction.game, transaction.regulatory);
                const {
                    RSP: {
                        BALANCE: [balance],
                        MESSAGE: message,
                    },
                } = await this.fetch<IResultRequest, IResultResponse>(
                    "result",
                    {
                        device: (transaction.channel || session.data.channel || "desktop") as IDevice,
                        sessionid: session.token,
                        accountid: player.nativeId,
                        opid: player.brand!,
                        currency: player.currency.toUpperCase(),
                        gpgameid: transaction.game!,
                        wonamount: transaction.amount,
                        roundid: transactionData.roundIdBigInt!,
                        transactionid: transactionData.transactionIdBigInt!,
                        ...(transaction.jackpotAmount ? {jpcamount: transaction.jackpotAmount, jpcbaseamount: transaction.jackpotAmount} : {}),
                        ...(gameDetails ? {gamedetails: gameDetails} : undefined),
                        ...freeRound,
                        gamestatus: "completed",
                    },
                    3,
                );
                const popups = [...(this.messageToPopup(message) ?? []), ...(endOfFreeRoundsPopup ?? [])];
                return {balance, popups};
            }
        }
    }

    async cancel(player: Player, transaction: IWalletTransaction, session: ISession): Promise<IWalletBalance> {
        const freeRounds = session.data.freeRounds;
        const {
            RSP: {
                BALANCE: [balance],
            },
        } = await this.fetch<IRollbackRequest, IRollbackResponse>(
            "rollback",
            {
                device: (transaction.channel || session.data.channel || "desktop") as IDevice,
                sessionid: session.token,
                accountid: player.nativeId,
                opid: player.brand!,
                gpgameid: transaction.game!,
                currency: player.currency.toUpperCase(),
                gamestatus: ["finished", "cancelled", "rejected"].includes(transaction.status!) ? "completed" : "pending",
                rollbackamount: transaction.amount,
                roundid: transaction.data!.roundIdBigInt!,
                transactionid: transaction.data!.transactionIdBigInt!,
                ...(transaction.jackpotAmount ? {jpcamount: transaction.jackpotAmount, jpcbaseamount: transaction.jackpotAmount} : {}),
                ...(freeRounds
                    ? {
                          type: "freerounds",
                          campaignid: freeRounds.campaignId,
                          activationid: freeRounds.activationId,
                      }
                    : null),
            },
            3,
        );

        return {balance};
    }

    async message(
        player: Player,
        data: {type: "freeRounds"; campaignId: string; activationId: string; optionData: {numberOfBets: string; betAmount: string}},
        session: ISession,
    ): Promise<{action: IExceptionPopupButton["action"]; data: {betAmount: string}}> {
        if (data.type === "freeRounds") {
            const {
                campaignId,
                activationId,
                optionData: {numberOfBets, betAmount},
            } = data;
            await Session.update({sessionId: session.sessionId}, {data: {...session.data, freeRounds: {campaignId, activationId, numberOfBets, betAmount}}});
            return {action: "freezeBet", data: {betAmount}};
        }
        throw new Exception("Unknown message");
    }

    private async isSidebet(roundId: string): Promise<boolean> {
        return (await Transaction.findBy({roundId, type: "withdraw"})).length > 1;
    }

    private freeRoundsToPopup(freeRounds: IFreeRound[]): IExceptionPopup[] | undefined {
        if (!freeRounds) return;

        const freeRound = freeRounds[0];
        const {
            CAMPAIGNID: [campaignId],
            ACTIVATIONID: [activationId],
            ENDDATE: [endDate],
            MESSAGES: messages,
        } = freeRound;
        const endDateFormatted = DateTime.local().until(DateTime.fromISO(endDate)).toDuration(["years", "months", "days", "hours", "minutes"]).toHuman({unitDisplay: "long", showZeros: false, maximumFractionDigits: 0});

        const popups: IExceptionPopup[] = [];
        const title = "lnw_freeBetsTitle";

        if (freeRound.OPTIONS.length === 0) throw new Exception(errorCodes.UNKNOWN);

        const inProgressOption = freeRound.OPTIONS[0].OPTION.find(option => {
            if (option.TOTALROUNDS[0] !== option.REMAININGROUNDS[0]) return true;
            return false;
        });

        if (inProgressOption) {
            popups.push({
                title,
                message: "lnw_freeBetsOngoing",
                options: [
                    {
                        label: {
                            key: "lnw_freeBetsOptionLabel",
                            data: {
                                betLevel: inProgressOption.BETLEVEL.toString(),
                                totalRounds: inProgressOption.TOTALROUNDS.toString(),
                                remainingRounds: inProgressOption.REMAININGROUNDS.toString(),
                            },
                        },
                        value: 0,
                        data: {
                            isFreeBetRoundStart: "true",
                            totalRounds: inProgressOption.TOTALROUNDS[0],
                            remainingRounds: inProgressOption.REMAININGROUNDS[0],
                            numberOfBets: inProgressOption.REMAININGROUNDS[0],
                            betAmount: inProgressOption.BETLEVEL[0],
                        },
                    },
                ],
                buttons: [{label: "lnw_freeBetsResume", action: "walletMessage", data: {type: "freeRounds", campaignId, activationId}}],
            });
            return popups;
        } else {
            const isRejectable = freeRound.REJECTABLE[0];
            const freeRoundMessageText = messages?.[0].MESSAGE[0].TEXT[0];
            const freeRoundMessage = freeRoundMessageText ? `<br><br>${freeRoundMessageText}<br><br>` : "";
            const options = freeRound.OPTIONS[0].OPTION.map((option, index) => {
                return {
                    label: {
                        key: "lnw_freeBetsOptionLabel",
                        data: {
                            betLevel: option.BETLEVEL.toString(),
                            totalRounds: option.TOTALROUNDS.toString(),
                            remainingRounds: option.REMAININGROUNDS.toString(),
                        },
                    },
                    value: index,
                    data: {
                        isFreeBetRoundStart: "true",
                        totalRounds: option.TOTALROUNDS[0],
                        remainingRounds: option.REMAININGROUNDS[0],
                        numberOfBets: option.REMAININGROUNDS[0],
                        betAmount: option.BETLEVEL[0],
                    },
                };
            });
            const buttons: IExceptionPopupButton[] = [{label: "lnw_freeBetsUseNow", action: "walletMessage", validationFn: "requiresOption", data: {type: "freeRounds", campaignId, activationId}}];

            if (isRejectable) {
                buttons.push({label: "lnw_freeBetsUseLater", action: "close"});
            }

            popups.push({
                title,
                message: endDate
                    ? {
                          key: "lnw_freeBetsStartEnd",
                          data: {freeRoundMessage, endDate: endDateFormatted},
                      }
                    : {
                          key: "lnw_freeBetsStart",
                          data: {freeRoundMessage},
                      },
                options,
                buttons,
            });
            return popups;
        }
    }

    private messageToPopup(message: IMessage) {
        if (!message) return;

        const popups: IExceptionPopup[] = [];
        const builder = new xml2js.Builder({rootName: "MESSAGE", xmldec: {version: "1.0", encoding: "UTF-8"}});
        const xmlMessage = builder.buildObject(message[0]);
        popups.push({message: xmlMessage, isCustomPopup: true});
        return popups;
    }

    private handleRcError(code: number): IExceptionPopup[] | undefined {
        const popups: IExceptionPopup[] = [];
        let errorCategoriy, errorSeverity, errorCode, errorMessage;
        switch (code) {
            case 1:
            case 2:
            case 3:
                errorCategoriy = "NON_RECOVERABLE_ERROR";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "A technical error has occurred. If it persists please contact customer support.";
                break;

            case 102:
                errorCategoriy = "RECOVERABLE_ERROR";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "A technical error has occurred. The game will now reload. If it persists please contact customer support.";
                break;

            case 110:
            case 1003:
            case 1007:
            case 1008:
            case 1041:
                errorCategoriy = "CRITICAL";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "A technical error has occurred. If it persists please contact customer support.";
                break;

            case 1000:
                errorCategoriy = "LOGIN_ERROR";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "You are not currently logged in. Please log in and try again.";
                break;

            case 1006:
                errorCategoriy = "INSUFFICIENT_FUNDS";
                errorSeverity = "INFO";
                errorCode = code;
                errorMessage = "You have insufficient funds to place this bet. Please top-up your account.";
                break;

            case 1019:
                errorCategoriy = "CRITICAL";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "Responsible gaming limits reached. The game will now close";
                break;

            case 1035:
                errorCategoriy = "CRITICAL";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "Your account is blocked. The game will now close. Please contact customer support.";
                break;

            case 1050:
                errorCategoriy = "RECOVERABLE_ERROR";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "The jackpot has been won by another player, your last wager has been refunded.";
                break;

            case 1109:
                errorCategoriy = "CRITICAL";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "Responsible gaming session expired. The game will now close.";
                break;

            default:
                errorCategoriy = "NON_RECOVERABLE_ERROR";
                errorSeverity = "ERROR";
                errorCode = code;
                errorMessage = "A technical error has occurred. If it persists please contact customer support.";
                break;
        }
        popups.push({title: `RC_ERROR:${errorCode}:${errorCategoriy}:${errorSeverity}`, message: errorMessage});
        return popups;
    }

    private async getGameDetails(game?: string, regulatory?: IRegulatory): Promise<IGameDetails | undefined> {
        if (!regulatory?.pt?.sm_result || !game) return undefined;

        const gameData = await Game.findOneBy({game});
        switch (gameData?.type) {
            case "slot":
                return {
                    slotMachines: {
                        result: regulatory.pt.sm_result,
                    },
                };
            default:
                throw new Exception("Unsupported game type for regulatory reporting");
        }
    }

    private encodeParams(params: Record<string, string>) {
        const encodedParams = new URLSearchParams();
        for (const param in params) {
            encodedParams.set(param.toLocaleLowerCase(), params[param]);
        }
        return encodedParams.toString();
    }

    private parseNumbers(value: string, name: string) {
        if (["ACCOUNTID", "ACTIVATIONID", "CAMPAIGNID"].includes(name)) return value;
        return xml2js.processors.parseNumbers(value);
    }

    private async fetch<IParams, IResponse>(request: ILnwApiRequest, params: IParams, retry: number): Promise<IResponse> {
        const authDetails = {loginname: this.config.username, password: this.config.password};
        const encodedParams = this.encodeParams({gpid: this.config.gpid, ...authDetails, ...params});
        const url = `${this.config.url}?request=${request}&apiversion=${apiVersion}&${encodedParams}`;

        do {
            let text;
            let json;
            try {
                const response = await fetch(url, {method: "GET", timeout: 20000});
                text = await response.text();
                json = await xml2js.parseStringPromise(text, {valueProcessors: [this.parseNumbers, xml2js.processors.parseBooleans], attrValueProcessors: [xml2js.processors.parseNumbers]});
            } catch (e) {
                if (retry === 0) {
                    throw new Exception("Couldn't fetch from wallet", {data: {error: e}});
                }
            } finally {
                logger.info(`Wallet outgoing call (${this.wallet}): ${url}`, {req: params, res: json || text});
            }

            if (json?.RSP?.$?.rc !== 0) {
                const rc = json?.RSP?.$?.rc;
                const msg = json?.RSP?.$?.msg;

                let code = rc < 100 ? errorCodes.UNKNOWN : errorCodes.TRANSACTION_FAILED;
                if (rc === "102") {
                    code = "TRANSACTION_NOT_FOUND";
                } else if (["1000", "1003"].includes(rc)) {
                    code = errorCodes.PLAYER_UNAUTHORIZED;
                } else if (rc === "1006") {
                    code = errorCodes.INSUFFICIENT_FUNDS;
                }

                if (["110", "1007", "1008"].includes(rc)) {
                    const content = `Unexpected error occurred in L&W Wallet Adapter.<br/>Error code: ${rc} (${msg})<br/>Please refer to L&W integration doc and resolve the issue.<br/>RoundId: ${(params as any).roundid}`;
                    sendAlert("L&W Wallet Adapter Error", content);
                }

                const popups = this.handleRcError(rc);
                throw new Exception("Transaction failed", {status: StatusCode.BAD_REQUEST, code, popups});
            } else if (json) {
                return json;
            }
        } while (--retry >= 0);
        throw new Exception("Couldn't parse the request");
    }

    private createDemoWalletPlayerKey(lnwCurrency?: string, lwnJurisdiction?: string, brand?: string): string | undefined {
        const currency = lnwCurrency ? lnwCurrency.toLowerCase() : "eur";
        const jurisdiction = lwnJurisdiction ? lwnJurisdiction.toLowerCase() : "mt";
        return `lnw_${v4()}:10000:${currency}:${jurisdiction}::${brand || ""}`;
    }

    private async getRoundHistory(roundIdBigInt: string, brandIds: string[]): Promise<IRoundHistoryData | undefined> {
        const qb = getConnection("replica")
            .manager.createQueryBuilder(Transaction, "transaction")
            .leftJoin(Player, "player", "player.id = transaction.playerId")
            .leftJoin(Game, "game", "game.game = transaction.game")
            .select("transaction.data->>'roundIdBigInt'", "roundIdBigInt")
            .addSelect("player.nativeId", "playerId")
            .addSelect("player.currency", "currency")
            .addSelect("player.brand", "brand")
            .addSelect("game.game", "game")
            .addSelect("game.title", "gameTitle")
            .addSelect("MIN(transaction.createdAt)", "createdAt")
            .addSelect("SUM(CASE WHEN transaction.type = 'withdraw' THEN transaction.amount ELSE 0 END)", "totalBet")
            .addSelect("SUM(CASE WHEN transaction.type = 'deposit' THEN transaction.amount ELSE 0 END)", "totalWin")
            .addSelect("(CASE WHEN transaction.status = 'finished' THEN 'completed' WHEN transaction.status = 'cancelled' THEN 'cancelled' ELSE 'pending' END)", "gameStatus")
            .where("transaction.data IS NOT NULL")
            .andWhere("transaction.data->>'roundIdBigInt' = :roundIdBigInt", {roundIdBigInt})
            .andWhere("player.brand IN (:...brandIds)", {brandIds})
            .groupBy("transaction.data->>'roundIdBigInt', transaction.status, player.nativeId, player.currency, player.brand, game.game, game.title")
            .limit(1);

        return await qb.getRawOne();
    }

    private async getPlayerRoundsHistory(playerId: string, from: string, brandIds: string[], game: string | undefined, limit: number): Promise<IRoundHistoryData[]> {
        const qb = getConnection("replica")
            .manager.createQueryBuilder(Transaction, "transaction")
            .leftJoin(Player, "player", "player.id = transaction.playerId")
            .leftJoin(Game, "game", "game.game = transaction.game")
            .select([
                `transaction.roundId as "roundId"`,
                `transaction.data->>'roundIdBigInt' AS "roundIdBigInt"`,
                `player.nativeId AS "playerId"`,
                "player.currency AS currency",
                "player.brand AS brand",
                "game.game AS game",
                `game.title AS "gameTitle"`,
                `transaction.createdAt AS "createdAt"`,
                "transaction.type AS type",
                "transaction.amount AS amount",
                "transaction.status AS status",
            ])
            .where("player.nativeId = :playerId", {playerId})
            .andWhere("player.brand IN (:...brandIds)", {brandIds})
            .andWhere("transaction.createdAt >= :from", {from})
            .orderBy("transaction.roundId")
            .take(limit + 1);

        if (game) {
            qb.andWhere("game.game = :game", {game});
        }

        const transactions = await qb.getRawMany();
        const roundsMap = new Map<string, IRoundHistoryData>();

        for (const transaction of transactions) {
            const roundId = transaction.roundId;
            if (!roundsMap.has(roundId)) {
                roundsMap.set(roundId, {
                    roundId: transaction.roundId,
                    roundIdBigInt: transaction.roundIdBigInt,
                    createdAt: transaction.createdAt,
                    brand: transaction.brand,
                    playerId: transaction.playerId,
                    game: transaction.game,
                    gameTitle: transaction.gameTitle,
                    gameStatus: transaction.status === "finished" ? "completed" : transaction.status === "cancelled" ? "cancelled" : "pending",
                    totalBet: "0",
                    totalWin: "0",
                    currency: transaction.currency,
                });
            }

            const roundData = roundsMap.get(roundId)!;
            if (transaction.type === "withdraw") {
                roundData.totalBet = (parseFloat(roundData.totalBet) + parseFloat(transaction.amount)).toString();
            } else if (transaction.type === "deposit") {
                roundData.totalWin = (parseFloat(roundData.totalWin) + parseFloat(transaction.amount)).toString();
            }
        }

        return Array.from(roundsMap.values());
    }

    private convertToDecimal(uuid: string) {
        const decimal = BigInt(`0x${uuid.replace(/-/g, "").substring(0, 15)}`);
        return decimal.toString();
    }
}

export default LnwWalletAdapter;
