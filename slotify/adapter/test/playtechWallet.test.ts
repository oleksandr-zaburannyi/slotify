import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {Wallet} from "../db/model/Wallet";
import {Express} from "express";
import fetch, {fetchAndParse, Response} from "@slotify/shared/lib/fetch";
import * as request from "supertest";
import {Transaction} from "../db/model/Transaction";
import {Player} from "../db/model/Player";
import {Game} from "../db/model/Game";
import {Rgs} from "../db/model/Rgs";
import * as crypto from "crypto";
import wait from "@slotify/shared/lib/wait";
import PlaytechWalletAdapter from "../walletAdapter/PlaytechWalletAdapter";
import {Session} from "../db/model/Session";
import {v4} from "uuid";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";

const walletConfig = {
    "url": "https://playtech.com",
    "internalSecretKey": "xyz",
    "gsId": "123",
    "mfgCode": "ABC",
    "key": "-----BEGIN RSA PRIVATE KEY----- ...",
    "cert": "-----BEGIN CERTIFICATE-----  ...",
    "gameVariants": {
        "test-game": [
            {
                "paytableId": "default",
                "paytableTitle": "My variant",
                "paytableDesc": "My variant description",
                "minPaybackPct": 96.1,
                "maxPaybackPct": 96.5,
            },
        ],
    },
};

let api: Express;
const wallet = "playtech";

const rgsConfig = {
    secretKey: "secret-rgs-key",
    realUrl: "https://cdn.test-provider.tech/real?game=${game}&server=https://test-provider.tech&wallet=${wallet}&operator=${operator}&key=${key}",
    funUrl: "https://cdn.test-provider.tech/fun?game=${game}&server=https://test-provider.tech&operator=${operator}&wallet=demo",
    replayUrl: "https://cdn.test-provider.tech/replay?game=${game}&server=https://test-provider.tech&operator=${operator}&wallet=demo&roundId=${roundId}",
};

beforeAll(async () => {
    setEnvVariables();
    process.env.IS_PRODUCTION = "false";
    process.env.URL = "https://tequity.com";
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Wallet.create({id: wallet, adapter: "playtech", config: walletConfig, ips: ["127.0.0.1", "::ffff:127.0.0.1"]}).save();
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await Game.create({game: "test-game2", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "jpy", rate: 1, date: new Date()}).save();
    api = await initService();
});
afterAll(async () => {
    await cleanupAfterTests();
});
jest.mock("@slotify/shared/lib/mail", () => ({sendMail: () => new Promise(jest.fn), initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const queueMockWalletResponse = (response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(response)) as Response));
};
const mockedFetchAndParse = fetchAndParse as jest.MockedFunction<typeof fetchAndParse>;
const queueMockPlatformServiceResponse = (response: any): void => {
    mockedFetchAndParse.mockReturnValueOnce(Promise.resolve(response));
};

afterEach(async () => {
    mockedFetch.mockReset();
    mockedFetchAndParse.mockReset();

    await Player.clear();
    await Transaction.clear();
});

const header = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

const launch = async (customParams: any = {}) => {
    const params = {
        licenseeid: "test-operator",
        skinid: "test-brand",
        playerid: "my-native-id",
        token: "my-token",
        crosslaunchurl: "https://refresh.com",
        language: "en-US",
        real: "1",
        localeCode: "en",
        jurisdiction: "mt",
        clientPlatform: "cp",
        clientType: "ct",
        game: "test-game__test-variant",
        ...customParams,
    };
    const res = await request(api).get("/wallet/playtech/launch").query(params).expect(302);
    const url = new URL(res.get("Location") as string);
    const key = url.searchParams.get("key")!;
    return {url, key};
};

const _meta = {
    apiFeatures: ["errorTags", "singleSession"],
    gpId: "tequity",
    gsId: walletConfig.gsId,
    requestId: expect.any(String),
};
const authenticate = async (key: string, {currencyCode = "EUR"} = {}, config?: any, urls?: any) => {
    queueMockWalletResponse({urls, secureToken: "sec", accountBalance: {currencyCode, balanceArray: [{balanceType: "cashable", balanceAmt: 123}]}});
    if (config) {
        queueMockWalletResponse(config);
    }
    const params = {key, wallet, operator: "test", provider: "test-provider", game: "test-game"};
    return await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params);
};

describe("playtech wallet adapter", () => {
    test("launch demo", async () => {
        const {url} = await launch({real: "0"});

        expect(url.origin).toEqual("https://cdn.test-provider.tech");
        expect(url.pathname).toEqual("/fun");
        expect(url.searchParams.get("game")).toEqual("test-game");
        expect(url.searchParams.get("server")).toEqual("https://test-provider.tech");
        expect(url.searchParams.get("wallet")).toEqual("demo");
        expect(url.searchParams.get("operator")).toEqual("playtech");
        expect(url.searchParams.get("key")).toEqual(expect.any(String));
        expect(url.searchParams.get("provider")).toEqual("test-provider");
        expect(url.searchParams.get("language")).toEqual("en");
    });

    test("launch real", async () => {
        const {url} = await launch();

        expect(url.origin).toEqual("https://cdn.test-provider.tech");
        expect(url.pathname).toEqual("/real");
        expect(url.searchParams.get("game")).toEqual("test-game");
        expect(url.searchParams.get("server")).toEqual("https://test-provider.tech");
        expect(url.searchParams.get("wallet")).toEqual("playtech");
        expect(url.searchParams.get("operator")).toEqual("playtech");
        expect(url.searchParams.get("key")).toEqual(expect.any(String));
        expect(url.searchParams.get("refreshUrl")).toEqual("https://refresh.com");
        expect(url.searchParams.get("provider")).toEqual("test-provider");
        expect(url.searchParams.get("language")).toEqual("en");
    });

    test("launch replay", async () => {
        const params = {
            gameCycleId: "round-id",
            gameId: "test-game__my_variant",
            languageCode: "en-US",
        };
        const res = await request(api).get("/wallet/playtech/dgh").query(params).expect(302);
        const url = new URL(res.get("Location") as string);

        expect(url.origin).toEqual("https://cdn.test-provider.tech");
        expect(url.pathname).toEqual("/replay");
        expect(url.searchParams.get("game")).toEqual("test-game");
        expect(url.searchParams.get("roundId")).toEqual("round-id");
        expect(url.searchParams.get("operator")).toEqual("playtech");
    });

    test("authenticate - eur", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);
        expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({
            _meta,
            gameId: "test-game__test-variant",
            includeUrls: true,
            localeCode: "en-US",
            playerId: "my-native-id",
            secureToken: "my-token",
            skinId: "test-brand",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "test-brand",
            country: "us",
            currency: "eur",
            jurisdiction: "mt",
            nativeId: "my-native-id",
            playerId: expect.any(String),
            sessionId: expect.any(String),
            sessionData: {gameId: "test-game__test-variant", settings: {"gameVariant": "test-variant"}, betConfig: {defaultBet: 1, maxBet: 10000, maxExposure: 10000000, minBet: 0.01}},
        });
    });

    test("authenticate - jpy", async () => {
        const {key} = await launch({historyurl: "http://history.com"});
        const {body} = await authenticate(key, {currencyCode: "JPY"});
        expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({
            _meta,
            gameId: "test-game__test-variant",
            includeUrls: true,
            localeCode: "en-US",
            playerId: "my-native-id",
            secureToken: "my-token",
            skinId: "test-brand",
        });
        expect(body).toEqual({
            balance: 123,
            brand: "test-brand",
            country: "us",
            currency: "jpy",
            jurisdiction: "mt",
            nativeId: "my-native-id",
            playerId: expect.any(String),
            sessionId: expect.any(String),
            sessionData: {gameId: "test-game__test-variant", settings: {"gameVariant": "test-variant"}, betConfig: {defaultBet: 1, maxBet: 10000, maxExposure: 10000000, minBet: 0.01}},
        });
    });

    test("authenticate - config", async () => {
        const {key} = await launch({cashierurl: "https://cashier.com?a=123", gamehistoryurl: "https://history.com"});
        const {body} = await authenticate(key, {}, {data: {configData: {minBet: 0.1, maxExposure: 10}, currencyMultiplier: 10}}, {cashier: "[get-from-url]?deposit", history: "https://google.com", lobby: "https://lobby.com"});
        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            _meta: {..._meta, apiFeatures: ["errorTags"]},
            currency: "EUR",
            gameId: "test-game__test-variant",
            secureToken: "sec",
            playerId: "my-native-id",
            skinId: "test-brand",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "test-brand",
            country: "us",
            currency: "eur",
            jurisdiction: "mt",
            nativeId: "my-native-id",
            playerId: expect.any(String),
            sessionId: expect.any(String),
            sessionData: {
                gameId: "test-game__test-variant",
                currencyRate: 10,
                betConfig: {minBet: 0.1, maxExposure: 10},
                settings: {
                    depositUrl: "https://cashier.com?deposit",
                    historyUrl: "https://history.com",
                    lobbyUrl: "https://lobby.com",
                    gameVariant: "test-variant",
                },
            },
        });
    });

    test("authenticate with incorrect key", async () => {
        await launch();
        const {body} = await authenticate("incorrect-key");

        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Error during decrypting"}});
    });

    test("balance", async () => {
        const {key} = await launch();
        const {
            body: {playerId},
        } = await authenticate(key);
        const params = {provider: "test-provider", game: "test-game", playerId};
        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        const {body} = await request(api).get("/rgs/test-rgs/balance").set(header({})).query(params).expect(200);

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            _meta: {..._meta, apiFeatures: ["errorTags"]},
            currency: "EUR",
            gameId: "test-game__test-variant",
            playerId: "my-native-id",
            secureToken: "sec",
            skinId: "test-brand",
        });
        expect(body).toEqual({balance: 1.23});
    });

    test("bet and win", async () => {
        const {key} = await launch();
        const {
            body: {playerId},
        } = await authenticate(key, {}, {});

        //bet
        const params1 = {playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        const transaction = await Transaction.findOneBy({rgsTransactionId: "t1"});
        expect(JSON.parse(mockedFetch.mock.calls[2][1]?.body as string)).toEqual({
            player: "my-native-id",
            casino: "test-brand",
            requestId: expect.any(String),
            rgsId: walletConfig.gsId,
            token: "sec",
            gameCycleData: {gameId: "test-game__test-variant", id: transaction!.roundId},
            transData: {id: transaction!.id, currency: "EUR", fundingSources: [{type: "money", value: 123}]},
        });
        expect(res1.body).toEqual({balance: 1.23});
        await wait(100);

        //win
        const params2 = {playerId, rgsTransactionId: "t2", amount: 1.23, roundId: "r", category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({
            balanceData: {balances: [{type: "cashable", amount: 123}]},
            messages: [{"type": "message", "msg": "Some message for user"}],
        });
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        const transaction2 = await Transaction.findOneBy({rgsTransactionId: "t2"});
        expect(JSON.parse(mockedFetch.mock.calls[3][1]?.body as string)).toEqual({
            player: "my-native-id",
            casino: "test-brand",
            requestId: expect.any(String),
            rgsId: walletConfig.gsId,
            token: "sec",
            gameCycleData: {gameId: "test-game__test-variant", id: transaction2!.roundId},
            transData: {id: transaction2!.id, currency: "EUR", payoutTargets: [{type: "money", value: 123}]},
            gameCycleFinishData: {},
        });
        expect(res2.body).toEqual({balance: 1.23, popups: [{message: "Some message for user", buttons: [{action: "close", label: "close"}]}]});
    });

    test("bet and win 0", async () => {
        const {key} = await launch();
        const {
            body: {playerId},
        } = await authenticate(key, {}, {});

        //bet
        const params1 = {playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        await wait(100);

        //win
        const params2 = {playerId, rgsTransactionId: "t2", amount: 0, roundId: "r", category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({
            balanceData: {balances: [{type: "cashable", amount: 123}]},
            messages: [{"type": "message", "msg": "Some message for user"}],
        });
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        const transaction2 = await Transaction.findOneBy({rgsTransactionId: "t2"});
        expect(JSON.parse(mockedFetch.mock.calls[3][1]?.body as string)).toEqual({
            player: "my-native-id",
            casino: "test-brand",
            requestId: expect.any(String),
            rgsId: walletConfig.gsId,
            token: "sec",
            gameCycleData: {gameId: "test-game__test-variant", id: transaction2!.roundId},
            gameCycleFinishData: {},
        });
        expect(res2.body).toEqual({balance: 1.23, popups: [{message: "Some message for user", buttons: [{action: "close", label: "close"}]}]});
    });

    test("cancel", async () => {
        const {key} = await launch();
        const {
            body: {playerId},
        } = await authenticate(key, {}, {});

        //bet
        const params1 = {playerId, rgsTransactionId: "t3", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);

        //cancel
        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        const params = {rgsTransactionId: "t3"};
        const {body} = await request(api).delete("/rgs/test-rgs/cancel").set(header(params)).send(params).expect(200);
        const transaction = await Transaction.findOneBy({rgsTransactionId: "t3"});

        expect(JSON.parse(mockedFetch.mock.calls[3][1]?.body as string)).toEqual({
            player: "my-native-id",
            casino: "test-brand",
            requestId: expect.any(String),
            rgsId: walletConfig.gsId,
            token: "sec",
            gameCycleData: {gameId: "test-game__test-variant", id: transaction!.roundId},
            cancelData: {id: "cancel_" + transaction!.id, originalId: transaction!.id},
        });
        expect(body).toEqual({balance: 1.23});
    });

    test("end", async () => {
        const {key} = await launch();
        const {
            body: {playerId},
        } = await authenticate(key, {}, {});
        queueMockWalletResponse({});
        const wallet = (await (jest.requireActual("../walletAdapter/walletAdapter") as any).getWalletAdapter("playtech")) as PlaytechWalletAdapter;
        const session = await Session.findOneBy({});
        const player = await Player.findOneBy({id: playerId});
        await wallet.end(player!, "expired", session!);

        expect(JSON.parse(mockedFetch.mock.calls[2][1]?.body as string)).toEqual({
            _meta: {..._meta, apiFeatures: ["errorTags"]},
            skinId: "test-brand",
            playerId: "my-native-id",
            secureToken: "sec",
        });
    });

    test("healthcheck", async () => {
        const {body} = await request(api).get("/wallet/playtech/healthcheck").expect(200);
        expect(body).toEqual({status: "ok"});
    });

    test("close-round - no refund", async () => {
        const params = {gsId: "gsid", gpId: "gpid", data: {gameCycleId: "round-id", refunded: false}};
        queueMockPlatformServiceResponse({});
        const {body} = await request(api).post("/wallet/playtech/close-round").send(params).expect(200);

        expect(JSON.parse(mockedFetchAndParse.mock.calls[0][1]?.body as string)).toEqual({roundId: "round-id", status: "finished"});
        expect(body).toEqual({gsId: "gsid", gpId: "gpid", command: "PTC_ResolveGameCycleAck", requestId: expect.any(String)});
    });

    test("close-round - refund", async () => {
        const transaction = await Transaction.create({roundId: "round-id", playerId: v4(), auto: false, rgsTransactionId: "rgsid", type: "withdraw", status: "finished", amount: 1}).save();
        const params = {gsId: "gsid", gpId: "gpid", data: {gameCycleId: "round-id", refunded: true}};
        queueMockPlatformServiceResponse({});
        const {body} = await request(api).post("/wallet/playtech/close-round").send(params).expect(200);

        await transaction.reload();
        expect(transaction.status).toEqual("cancelled");
        expect(JSON.parse(mockedFetchAndParse.mock.calls[0][1]?.body as string)).toEqual({roundId: "round-id", status: "cancelled"});
        expect(body).toEqual({gsId: "gsid", gpId: "gpid", command: "PTC_ResolveGameCycleAck", requestId: expect.any(String)});
    });

    test("marketplace config", async () => {
        const {body} = await request(api).get("/wallet/playtech/config-schema.json").expect(200);
        expect(body.properties.defaultBet.title).toEqual("Default Bet (in currency)");
    });

    test("marketplace game list", async () => {
        const {body} = await request(api)
            .post("/wallet/playtech/tpi")
            .send({request: {igpId: "igp", rgsId: "rgsid"}})
            .expect(200);
        expect(body).toEqual({
            response: {
                igpId: "igp",
                rgsId: "rgsid",
                command: "TPI_gameList",
                requestId: expect.any(String),
                data: {
                    gameArray: [
                        {
                            PTC_defaultConfig: JSON.stringify({minBet: 0.01, maxBet: 10000, maxExposure: 10000000, defaultBet: 1}),
                            channelArray: [
                                {channelType: "desktop", presentType: "HTML5"},
                                {channelType: "mobile", presentType: "HTML5"},
                            ],
                            configHash: expect.any(String),
                            configSchema: "https://tequity.com/wallet/playtech/config-schema.json",
                            gameDesc: "ABC_test-game Description",
                            gameId: "ABC_test-game",
                            gameTitle: "ABC_test-game (default)",
                            gameType: "spinningReel",
                            jurisdictionArray: [],
                            localeArray: [],
                            mfgCode: "ABC",
                            packageId: "ABC_test-game",
                            packageVersion: "1.0.0",
                            parameterArray: [{paramDefault: "test-game", paramDesc: "Game code description", paramId: "gameCode", paramRequired: true, paramTitle: "Game code"}],
                            paytableArray: [{maxPaybackPct: 96.5, minPaybackPct: 96.1, paytableDesc: "My variant description", paytableId: "default", paytableTitle: "My variant"}],
                            skinArray: [],
                            themeId: "ABC_test-game",
                            currencyArray: expect.arrayContaining([{"currencyCode": "EUR"}, {"currencyCode": "JPY"}]),
                        },
                    ],
                },
            },
        });
    });

    test("error - fatal - messages v1", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        queueMockWalletResponse({
            errorCode: 123,
            errorTags: ["fatal"],
            messages: [
                {type: "message", msg: "Error message"},
                {type: "error", msg: "Error message", extraData: {a: 123}},
            ],
        });
        const params = {playerId: body.playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({
            error: {
                code: "TRANSACTION_FAILED",
                message: "Transaction failed",
                popups: [
                    {message: "Error message", buttons: [{action: "close", label: "close"}]},
                    {title: "errorTitle", message: "Error message", buttons: [{action: "exit", data: {a: 123}, label: "close"}]},
                ],
            },
        });
    });

    test("error - fatal - messages v2", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        queueMockWalletResponse({
            errorCode: 123,
            errorTags: ["fatal"],
            messageArray: [
                {msgType: "Message", accountMsg: "Error message"},
                {msgType: "Error", accountMsg: "Error message", extraData: {a: 123}},
            ],
        });
        const params = {playerId: body.playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({
            error: {
                code: "TRANSACTION_FAILED",
                message: "Transaction failed",
                popups: [
                    {message: "Error message", buttons: [{action: "close", label: "close"}]},
                    {title: "errorTitle", message: "Error message", buttons: [{action: "exit", data: {a: 123}, label: "close"}]},
                ],
            },
        });
    });

    test("error - retry", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        const params = {playerId: body.playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(200);

        await wait(100);
        queueMockWalletResponse({errorCode: 123, errorTags: ["retriable"]});
        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        const params2 = {playerId: body.playerId, rgsTransactionId: "t2", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "deposit", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(res.body).toEqual({balance: 1.23});
        const n = mockedFetch.mock.calls.length;
        expect(JSON.parse(mockedFetch.mock.calls[n - 1][1]?.body as string).requestId).not.toEqual(JSON.parse(mockedFetch.mock.calls[n - 2][1]?.body as string).requestId);
    });

    test("error - cancel", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        queueMockWalletResponse({errorCode: 123, errorTags: ["cancel"]});
        const params = {playerId: body.playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "UNKNOWN", message: "Transaction failed"}});
    });

    test("error - retry unsuccesful", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        queueMockWalletResponse({balanceData: {balances: [{type: "cashable", amount: 123}]}});
        const params = {playerId: body.playerId, rgsTransactionId: "t3", amount: 1.23, roundId: "r2", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(200);
        await wait(200);

        queueMockWalletResponse({errorCode: 123, errorTags: ["retriable"]});
        queueMockWalletResponse({errorCode: 123, errorTags: []});
        const params2 = {playerId: body.playerId, rgsTransactionId: "t4", amount: 1.23, roundId: "r2", category: "normal", roundFinished: false, type: "deposit", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);
        expect(res.body).toEqual({error: {code: "TRANSACTION_FAILED", message: "Transaction failed"}});
    });

    test("error - network error", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        const params = {playerId: body.playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Couldn't fetch from wallet"}});
    });

    test("error - ERR004", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        queueMockWalletResponse({errorCode: "ERR004", errorTags: []});
        const params = {playerId: body.playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "CLOSE_ROUND", message: "Transaction failed"}});
    });

    test("error - realitycheck popup", async () => {
        const {key} = await launch();
        const {body} = await authenticate(key);

        queueMockWalletResponse({errorCode: "ERR2210", errorTags: [], messages: [{msg: "RC message", type: "error"}]});
        const params = {playerId: body.playerId, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({
            error: {
                code: "TRANSACTION_FAILED",
                message: "Transaction failed",
                popups: [
                    {
                        message: "RC message",
                        title: "errorTitle",
                        buttons: [
                            {label: "stop", action: "walletMessage", data: {type: "realityCheck", choice: "stopgaming"}},
                            {label: "continue", action: "walletMessage", data: {type: "realityCheck", choice: "reset"}},
                        ],
                    },
                ],
            },
        });
    });

    test("error - realitycheck message reset", async () => {
        const {key} = await launch();
        await authenticate(key);
        const [{id: playerId}] = await Player.find({take: 1});

        queueMockWalletResponse({regulationTypeData: {regulationCommand: "RealityCheckDialogResponseAck"}});
        const params = {playerId, provider: "test-provider", game: "test-game", data: {type: "realityCheck", choice: "reset"}};
        const res = await request(api).post("/rgs/test-rgs/message").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({action: "close"});
    });

    test("error - realitycheck message stop", async () => {
        const {key} = await launch();
        await authenticate(key);
        const [{id: playerId}] = await Player.find({take: 1});

        queueMockWalletResponse({regulationTypeData: {regulationCommand: "RealityCheckDialogResponseAck"}});
        const params = {playerId, provider: "test-provider", game: "test-game", data: {type: "realityCheck", choice: "stopgaming"}};
        const res = await request(api).post("/rgs/test-rgs/message").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({action: "exit"});
    });
});
