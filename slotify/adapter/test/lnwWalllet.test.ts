import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {afterAll, beforeAll, describe, test} from "@jest/globals";
import {setEnvVariables} from "./setEnvVariables";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {Wallet} from "../db/model/Wallet";
import {Rgs} from "../db/model/Rgs";
import {Game} from "../db/model/Game";
import {Express} from "express";
import fetch, {RequestInfo, Response} from "@slotify/shared/lib/fetch";
import * as request from "supertest";
import * as crypto from "crypto";
import {Player} from "../db/model/Player";
import * as xml2js from "xml2js";
import {v4} from "uuid";
import wait from "@slotify/shared/lib/wait";
import {parseNumbers} from "xml2js/lib/processors";
import {DateTime} from "../util/luxon";
import logger from "@slotify/shared/lib/logger";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {CurrencyAlias} from "../db/model/CurrencyAlias";

let api: Express;

const wallet = "lnw-wallet";
const brandWithCurrencyAlias = "alias-brand";
const walletCurrency = "eur";
const walletCurrencyAlias = "eur-lnw";
const walletConfig = {
    url: "https://lnw.wallet.com/api/test-provider",
    username: "test-user",
    password: "test-password",
    gpid: "290",
    authUrl: "https://lnw.wallet.com/auth",
    creditApiUrl: "https://lnw.wallet.com/credit-api",
    creditApiClientId: "credit-api-client",
    creditApiClientSecret: "credit-api-secret",
    ogsGameIdsMapping: {
        "123456": "test-game",
        "789012": "test-game2",
    },
    currencyAliasesPerBrand: {
        [walletCurrency]: {
            [brandWithCurrencyAlias]: walletCurrencyAlias,
        },
    },
};
const rgsConfig = {
    secretKey: "secret-rgs-key",
    realUrl: "https://cdn.test-provider.tech/real?game=${game}&server=https://test-provider.tech&wallet=${wallet}&operator=${operator}&key=${key}",
    funUrl: "https://cdn.test-provider.tech/fun?game=${game}&server=https://test-provider.tech&operator=${operator}&wallet=demo",
    replayUrl: "https://cdn.test-provider.tech/replay?game=${game}&server=https://test-provider.tech&operator=${operator}&wallet=demo&roundId=${roundId}",
};

beforeAll(async () => {
    setEnvVariables();
    process.env.IS_PRODUCTION = "false";
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Wallet.create({id: wallet, adapter: "lnw", config: walletConfig}).save();
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    await CurrencyAlias.create({currency: walletCurrency, alias: walletCurrencyAlias, multiplier: 1}).save();
    await CurrencyExchange.create({currency: walletCurrencyAlias, rate: 1, date: new Date()}).save();
    api = await initService();

    // disable inspectionConfig to allow multiple withdraws in order to test sidebets
    await Rgs.update({id: "test-rgs"}, {inspectionConfig: {}});
});
afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const queueMockWalletResponse = (response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(response)) as Response));
};
const queueMockWalletXMLResponse = (request: string, response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(toXML(request, response)) as Response));
};
const toXML = (request: string, params: any) => {
    const builder = new xml2js.Builder({rootName: "RSP", xmldec: {version: "1.0", encoding: "UTF-8"}});
    const response = {$: {request, rc: "0"}, APIVERSION: "1.5"};
    return builder.buildObject({
        ...response,
        ...params,
    });
};

function isBigInt(value: string) {
    try {
        return BigInt(parseInt(value, 10)) !== BigInt(value);
    } catch {
        return false;
    }
}

const queryStringToObject = (url: RequestInfo) => {
    const urlParams = new URLSearchParams((url as string).split("?")[1]);
    const objParams: Record<string, string | number> = {};
    for (const [key, value] of urlParams.entries()) {
        // don't convert bigint since JSON.stringify has issues when serialising
        objParams[key] = isNaN(+value) || isBigInt(value) ? value : parseFloat(value);
    }
    return objParams;
};

afterEach(async () => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();
});

const standardRequest = {
    apiversion: 1.5,
    accountid: 1234,
    device: "desktop",
    gpgameid: "test-game",
    gpid: 290,
    loginname: "test-user",
    password: "test-password",
    opid: "casino",
    currency: "EUR",
    sessionid: "session-id",
};

const launch = async (customParams: any = {}) => {
    const params = {
        operatorid: "casino",
        gameid: "test-game",
        sessionid: "session-id",
        mode: "real",
        lang: "en",
        currency: "eur",
        device: "desktop",
        lobbyurl: "https://lobby.com",
        depositurl: "https://deposit.com",
        ...customParams,
    };
    const response = await request(api).get("/wallet/lnw-wallet/game").query(params).expect(302);
    const [baseUrl, paramsUrl] = response.headers.location.split("?");
    const launchParams = new URLSearchParams(paramsUrl);
    return {baseUrl, launchParams};
};

const authenticate = async (launchParams: any) => {
    queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "SEK", COUNTRY: "SWE", SESSIONID: "session-id"});
    queueMockWalletXMLResponse("getbalance", {ACCOUNTID: 1234, BALANCE: 1.23, SESSIONID: "session-id"});
    const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
    return request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);
};

const header = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

const parseStringPromise = async (str: string, options?: xml2js.ParserOptions) => {
    let json;
    try {
        json = await xml2js.parseStringPromise(str, options);
    } catch (e) {
        const asciiString = Array.from(str, char => {
            return char.charCodeAt(0);
        });
        logger.error("Response (ASCII):", asciiString.join(" "));
        throw e;
    }
    return json;
};

describe("lnw wallet adapter", () => {
    test("launch demo", async () => {
        const {baseUrl, launchParams} = await launch({mode: "demo"});

        expect(baseUrl).toEqual("https://cdn.test-provider.tech/fun");
        expect(launchParams.get("game")).toEqual("test-game");
        expect(launchParams.get("provider")).toEqual("test-provider");
        expect(launchParams.get("lobbyUrl")).toEqual("https://lobby.com");
        expect(launchParams.get("depositUrl")).toEqual("https://deposit.com");
        expect(launchParams.get("language")).toEqual("en");
        expect(launchParams.get("operator")).toEqual("lnw");
        expect(launchParams.get("channel")).toEqual("desktop");
    });
    test("launch real", async () => {
        const {baseUrl, launchParams} = await launch({device: "mobile"});

        expect(baseUrl).toEqual("https://cdn.test-provider.tech/real");
        expect(launchParams.get("game")).toEqual("test-game");
        expect(launchParams.get("provider")).toEqual("test-provider");
        expect(launchParams.get("lobbyUrl")).toEqual("https://lobby.com");
        expect(launchParams.get("depositUrl")).toEqual("https://deposit.com");
        expect(launchParams.get("language")).toEqual("en");
        expect(launchParams.get("operator")).toEqual("lnw");
        expect(launchParams.get("channel")).toEqual("mobile");
    });
    test("launch real - malta jurisdiction", async () => {
        const {baseUrl, launchParams} = await launch({
            jurisdiction: "mt",
            realitycheck_mt_elapsed: 0,
            realitycheck_mt_limit: 3600,
        });

        expect(baseUrl).toEqual("https://cdn.test-provider.tech/real");
        expect(launchParams.get("game")).toEqual("test-game");
        expect(launchParams.get("provider")).toEqual("test-provider");
        expect(launchParams.get("lobbyUrl")).toEqual("https://lobby.com");
        expect(launchParams.get("depositUrl")).toEqual("https://deposit.com");
        expect(launchParams.get("depositUrl")).toEqual("https://deposit.com");
        expect(launchParams.get("language")).toEqual("en");
        expect(launchParams.get("operator")).toEqual("lnw");
        expect(launchParams.get("channel")).toEqual("desktop");
        expect(launchParams.get("realityCheckElapsed")).toEqual("0");
        expect(launchParams.get("realityCheckInterval")).toEqual("60");
    });
    test("launch real - ukgc jurisdiction", async () => {
        const {baseUrl, launchParams} = await launch({
            jurisdiction: "uk",
            realitycheck_uk_elapsed: 456,
            realitycheck_uk_limit: 3600,
            realitycheck_uk_proceed: "https://proceed.com",
            realitycheck_uk_history: "https://history.com",
            realitycheck_uk_autospin: "https://autospin.com",
            realitycheck_uk_exit: "https://exit.com",
        });

        expect(baseUrl).toEqual("https://cdn.test-provider.tech/real");
        expect(launchParams.get("game")).toEqual("test-game");
        expect(launchParams.get("provider")).toEqual("test-provider");
        expect(launchParams.get("lobbyUrl")).toEqual("https://lobby.com");
        expect(launchParams.get("depositUrl")).toEqual("https://deposit.com");
        expect(launchParams.get("language")).toEqual("en");
        expect(launchParams.get("operator")).toEqual("lnw");
        expect(launchParams.get("channel")).toEqual("desktop");
        expect(launchParams.get("realityCheckElapsed")).toEqual("7.6");
        expect(launchParams.get("realityCheckInterval")).toEqual("60");
    });
    test("authenticate", async () => {
        const {launchParams} = await launch();

        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "EUR", COUNTRY: "SWE", SESSIONID: "session-id"});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "casino",
            currency: "eur",
            nativeId: "1234_casino",
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    test("authenticate - maxbet", async () => {
        const {launchParams} = await launch();

        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "EUR", COUNTRY: "SWE", SESSIONID: "session-id", PLAYERMAXSTAKE: 200});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "casino",
            currency: "eur",
            nativeId: "1234_casino",
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {maxBet: 200}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    // Skipping due to: "will need to comment away the defaults on our side until we receive info that the restrictions need to go live"
    test.skip("authenticate - uk - no maxbet (fallback: 2)", async () => {
        const {launchParams} = await launch({jurisdiction: "uk"});

        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "EUR", COUNTRY: "SWE", SESSIONID: "session-id"});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "casino",
            currency: "eur",
            jurisdiction: "uk",
            nativeId: "1234_casino",
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {maxBet: 2}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    test.skip("authenticate - uk - maxbet 'null'", async () => {
        const {launchParams} = await launch({jurisdiction: "uk"});

        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "EUR", COUNTRY: "SWE", SESSIONID: "session-id", PLAYERMAXSTAKE: null});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "casino",
            currency: "eur",
            jurisdiction: "uk",
            nativeId: "1234_casino",
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {maxBet: 2}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    test("authenticate - uk - maxbet 1", async () => {
        const {launchParams} = await launch({jurisdiction: "uk"});

        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "EUR", COUNTRY: "SWE", SESSIONID: "session-id", PLAYERMAXSTAKE: 1});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "casino",
            currency: "eur",
            jurisdiction: "uk",
            nativeId: "1234_casino",
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {maxBet: 1}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    test("authenticate - uk - maxbet 2", async () => {
        const {launchParams} = await launch({jurisdiction: "uk"});

        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "EUR", COUNTRY: "SWE", SESSIONID: "session-id", PLAYERMAXSTAKE: 10});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "casino",
            currency: "eur",
            jurisdiction: "uk",
            nativeId: "1234_casino",
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {maxBet: 2}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    test("authenticate - uk maxbet 5", async () => {
        const {launchParams} = await launch({jurisdiction: "uk"});

        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: "EUR", COUNTRY: "SWE", SESSIONID: "session-id", PLAYERMAXSTAKE: 5});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            brand: "casino",
            currency: "eur",
            jurisdiction: "uk",
            nativeId: "1234_casino",
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {maxBet: 5}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    test("balance", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const params = {provider: "test-provider", game: "test-game", playerId: player!.id};
        queueMockWalletXMLResponse("balance", {BALANCE: 1.23, SESSIONID: "session-id"});
        const {body} = await request(api).get("/rgs/test-rgs/balance").set(header({})).query(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({balance: 1.23});
    });
    test("balance - with message", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const params = {provider: "test-provider", game: "test-game", playerId: player!.id};
        queueMockWalletXMLResponse("balance", {BALANCE: 1.23, SESSIONID: "session-id", MESSAGE: {TITLE: "MSG TITLE", TEXT: "MSG TEXT"}});
        const {body} = await request(api).get("/rgs/test-rgs/balance").set(header({})).query(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 1.23,
            popups: [
                {
                    message: `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE>
  <TITLE>MSG TITLE</TITLE>
  <TEXT>MSG TEXT</TEXT>
</MESSAGE>`,
                    isCustomPopup: true,
                },
            ],
        });
    });
    test("bet and win", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t1", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "wager",
            betamount: 1.23,
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res1.body).toEqual({balance: 1.23});
        await wait(100);

        //win
        const params2 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t2", amount: 1.23, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("result", {BALANCE: 1.23, SESSIONID: "session-id"});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[3][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "result",
            wonamount: 1.23,
            gamestatus: "completed",
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res2.body).toEqual({balance: 1.23, popups: []});
    });
    test("bet and win - sidebet", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t3", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);

        //bet - sidebet
        const params2 = {...params1, rgsTransactionId: "t3-sidebet"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "wager",
            betamount: 1.23,
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(queryStringToObject(mockedFetch.mock.calls[3][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "wager",
            betamount: 1.23,
            transactionid: expect.anything(),
            roundid: expect.anything(),
            type: "sidebet",
        });
        expect(res1.body).toEqual({balance: 1.23});
        await wait(100);

        //win
        const params3 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t4", amount: 1.23, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("result", {BALANCE: 1.23, SESSIONID: "session-id"});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params3)).send(params3).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[4][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "result",
            wonamount: 1.23,
            gamestatus: "completed",
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res2.body).toEqual({balance: 1.23, popups: []});
    });
    test("bet and win - with withdraw message", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t5", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id", MESSAGE: {TITLE: "MSG TITLE", TEXT: "MSG TEXT"}});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "wager",
            betamount: 1.23,
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res1.body).toEqual({
            balance: 1.23,
            popups: [
                {
                    message: `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE>
  <TITLE>MSG TITLE</TITLE>
  <TEXT>MSG TEXT</TEXT>
</MESSAGE>`,
                    isCustomPopup: true,
                },
            ],
        });
        await wait(100);

        //win
        const params2 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t6", amount: 1.23, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("result", {BALANCE: 1.23, SESSIONID: "session-id"});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[3][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "result",
            wonamount: 1.23,
            gamestatus: "completed",
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res2.body).toEqual({balance: 1.23, popups: []});
    });
    test("bet and win - with deposit message", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t7", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "wager",
            betamount: 1.23,
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res1.body).toEqual({balance: 1.23});
        await wait(100);

        //win
        const params2 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t8", amount: 1.23, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("result", {BALANCE: 1.23, SESSIONID: "session-id", MESSAGE: {TITLE: "MSG TITLE", TEXT: "MSG TEXT"}});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[3][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "result",
            wonamount: 1.23,
            gamestatus: "completed",
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res2.body).toEqual({
            balance: 1.23,
            popups: [
                {
                    message: `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE>
  <TITLE>MSG TITLE</TITLE>
  <TEXT>MSG TEXT</TEXT>
</MESSAGE>`,
                    isCustomPopup: true,
                },
            ],
        });
    });
    test("credit api", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t9", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "wager",
            betamount: 1.23,
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res1.body).toEqual({balance: 1.23});
        await wait(100);

        //win
        const params2 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t10", amount: 2, roundId, category: "promo", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({token_type: "Bearer", access_token: "credit-api-access-token"});
        queueMockWalletResponse({player: {realbalance: 1.25}});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(mockedFetch.mock.calls[3][1]?.headers).toEqual({
            "Content-Type": "application/json",
            "Authorization": `Basic ${Buffer.from(`${walletConfig.creditApiClientId}:${walletConfig.creditApiClientSecret}`).toString("base64")}`,
        });
        expect(mockedFetch.mock.calls[4][1]?.headers).toEqual({
            Authorization: "Bearer credit-api-access-token",
        });
        expect(JSON.parse(mockedFetch.mock.calls[4][1]?.body as string)).toEqual({
            gameDetail: {
                gpGameId: "test-game",
                gpId: walletConfig.gpid,
            },
            player: {
                accountId: "1234",
                opId: "casino",
            },
            transaction: {
                transactionAmount: 2,
                currency: "EUR",
                transactionId: expect.any(String),
                sessionId: expect.any(String),
                baseGameRoundId: expect.any(String),
            },
        });
        expect(res2.body).toEqual({balance: 1.25});
    });
    test("cancel", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();

        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "t11", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {ACCOUNTID: 1234, BALANCE: 1.23, SESSIONID: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);

        //cancel
        queueMockWalletXMLResponse("rollback", {ACCOUNTID: 1234, BALANCE: 1.23, SESSIONID: "session-id"});
        const params = {rgsTransactionId: "t11", channel: "desktop"};
        const {body} = await request(api).delete("/rgs/test-rgs/cancel").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[3][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            request: "rollback",
            rollbackamount: 1.23,
            gamestatus: "completed",
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(body).toEqual({balance: 1.23});
    });
    test("launch real - currency alias per brand", async () => {
        const {launchParams} = await launch({operatorid: brandWithCurrencyAlias, currency: walletCurrency});
        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: walletCurrency.toUpperCase(), COUNTRY: "SWE", SESSIONID: "session-id"});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 9.99, SESSIONID: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[0][0])).toEqual({
            ...standardRequest,
            accountid: undefined,
            currency: walletCurrency.toUpperCase(),
            opid: brandWithCurrencyAlias,
            lang: "en",
            request: "getaccount",
        });
        expect(queryStringToObject(mockedFetch.mock.calls[1][0])).toEqual({
            ...standardRequest,
            currency: walletCurrency.toUpperCase(),
            opid: brandWithCurrencyAlias,
            request: "getbalance",
        });
        expect(body).toEqual({
            balance: 9.99,
            brand: brandWithCurrencyAlias,
            currency: walletCurrencyAlias,
            nativeId: `1234_${brandWithCurrencyAlias}`,
            playerId: expect.any(String),
            popups: [],
            sessionData: {betConfig: {}, channel: "desktop", language: "en", sessionid: "session-id"},
            sessionId: expect.any(String),
        });
    });
    test("bet and win - currency alias per brand", async () => {
        const {launchParams} = await launch({operatorid: brandWithCurrencyAlias, currency: walletCurrency});
        queueMockWalletXMLResponse("getaccount", {ACCOUNTID: 1234, CURRENCY: walletCurrency.toUpperCase(), COUNTRY: "SWE", SESSIONID: "session-id"});
        queueMockWalletXMLResponse("getbalance", {BALANCE: 50, SESSIONID: "session-id"});
        const authParams = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        await request(api).post("/rgs/test-rgs/authenticate").set(header(authParams)).send(authParams).expect(200);
        const player = await Player.findOneBy({brand: brandWithCurrencyAlias});
        expect(player).toBeTruthy();
        const roundId = v4();
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "alias-t1", amount: 1.5, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 48.5, SESSIONID: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[2][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            opid: brandWithCurrencyAlias,
            currency: walletCurrency.toUpperCase(),
            request: "wager",
            betamount: 1.5,
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res1.body).toEqual({balance: 48.5});
        await wait(100);

        const params2 = {playerId: player!.id, channel: "desktop", rgsTransactionId: "alias-t2", amount: 6.5, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("result", {BALANCE: 55, SESSIONID: "session-id"});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(queryStringToObject(mockedFetch.mock.calls[3][0])).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            opid: brandWithCurrencyAlias,
            currency: walletCurrency.toUpperCase(),
            request: "result",
            wonamount: 6.5,
            gamestatus: "completed",
            transactionid: expect.anything(),
            roundid: expect.anything(),
        });
        expect(res2.body).toEqual({balance: 55, popups: []});
    });
    test("service api - getroundid - bet only", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({brand: "casino"});
        const roundId = v4();
        const rgsTransactionId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId, amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        await wait(100);

        const reqParams = queryStringToObject(mockedFetch.mock.calls[2][0]);
        const params2 = {loginname: walletConfig.username, password: walletConfig.password, request: "getroundid", roundid: reqParams.roundid.toString(), opids: reqParams.opid.toString()};
        const searchParams = new URLSearchParams(params2).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);
        const json = await parseStringPromise(response.text, {valueProcessors: [parseNumbers]});

        expect(json).toEqual({
            RSP: {
                $: {rc: "0", request: "getroundid"},
                APIVERSION: [1.5],
                ROUNDS: [
                    {
                        ROUND: [
                            {
                                $: {created: expect.any(String), id: `${reqParams.roundid}`},
                                ACCOUNTID: [1234],
                                CURRENCY: ["EUR"],
                                GAMENAME: ["test-game"],
                                GPGAMEID: ["test-game"],
                                GAMESTATUS: ["completed"],
                                OPID: ["casino"],
                                TOTALBET: [1.23],
                                TOTALWIN: [0],
                                GAMEDATA: [
                                    {
                                        $: {format: "external"},
                                        _: expect.any(String),
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
    });
    test("service api - getroundid - bet & win", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({brand: "casino"});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: v4(), amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        await wait(100);

        //win
        const params2 = {playerId: player!.id, channel: "desktop", rgsTransactionId: v4(), amount: 1.5, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("result", {BALANCE: 2.73, SESSIONID: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        const reqParams = queryStringToObject(mockedFetch.mock.calls[3][0]);
        const params3 = {loginname: walletConfig.username, password: walletConfig.password, request: "getroundid", roundid: reqParams.roundid.toString(), opids: reqParams.opid.toString()};
        const searchParams = new URLSearchParams(params3).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);
        const json = await parseStringPromise(response.text, {valueProcessors: [parseNumbers]});

        expect(json).toEqual({
            RSP: {
                $: {rc: "0", request: "getroundid"},
                APIVERSION: [1.5],
                ROUNDS: [
                    {
                        ROUND: [
                            {
                                $: {created: expect.any(String), id: `${reqParams.roundid}`},
                                ACCOUNTID: [1234],
                                CURRENCY: ["EUR"],
                                GAMENAME: ["test-game"],
                                GPGAMEID: ["test-game"],
                                GAMESTATUS: ["completed"],
                                OPID: ["casino"],
                                TOTALBET: [1.23],
                                TOTALWIN: [1.5],
                                GAMEDATA: [
                                    {
                                        $: {format: "external"},
                                        _: expect.any(String),
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
    });
    test("service api - getrounds", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({brand: "casino"});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, channel: "desktop", rgsTransactionId: v4(), amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("wager", {BALANCE: 1.23, SESSIONID: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        await wait(100);

        //win
        const params2 = {playerId: player!.id, channel: "desktop", rgsTransactionId: v4(), amount: 1.5, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletXMLResponse("result", {BALANCE: 2.73, SESSIONID: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        const reqParams = queryStringToObject(mockedFetch.mock.calls[3][0]);
        const start = DateTime.utc().minus({minutes: 5}).toISO();
        const params3 = {loginname: walletConfig.username, password: walletConfig.password, request: "getrounds", accountid: standardRequest.accountid.toString(), start, opids: reqParams.opid.toString()};
        const searchParams = new URLSearchParams(params3).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);
        const json = await parseStringPromise(response.text, {valueProcessors: [parseNumbers]});

        const repeat = json.RSP.ROUNDS[0].ROUND.length;
        expect(json).toEqual({
            RSP: {
                $: {rc: "0", request: "getrounds"},
                APIVERSION: [1.5],
                ROUNDS: [
                    {
                        ROUND: Array(repeat).fill({
                            $: {created: expect.any(String), id: expect.anything()},
                            ACCOUNTID: [1234],
                            CURRENCY: ["EUR"],
                            GAMENAME: ["test-game"],
                            GPGAMEID: ["test-game"],
                            GAMESTATUS: [expect.stringMatching(/completed|cancelled/)],
                            OPID: ["casino"],
                            TOTALBET: [expect.any(Number)],
                            TOTALWIN: [expect.any(Number)],
                            GAMEDATA: [
                                {
                                    $: {format: "external"},
                                    _: expect.any(String),
                                },
                            ],
                        }),
                    },
                ],
            },
        });
    });
    test("service api - getbetlevels", async () => {
        queueMockWalletResponse({data: {currencyList: ["eur", "usd", "sek"]}});
        queueMockWalletResponse({
            data: {
                availableBetsBulk: {
                    bets: {
                        "test-game": {
                            "eur": ["0.1", "0.5", "1", "2", "5"],
                            "usd": ["0.1", "0.5", "1", "2", "5", "10"],
                            "sek": ["0.01", "0.05", "0.1", "0.5"],
                        },
                    },
                },
            },
        });
        const params3 = {loginname: walletConfig.username, password: walletConfig.password, request: "getbetlevels", gpgameid: "test-game"};
        const searchParams = new URLSearchParams(params3).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);
        const json = await parseStringPromise(response.text, {valueProcessors: [parseNumbers]});

        expect(json).toEqual({
            RSP: {
                $: {rc: "0", request: "getbetlevels"},
                APIVERSION: [1.5],
                GAMES: [
                    {
                        GAME: [
                            {
                                $: {gamechoice: "false", gpgameid: "test-game", playerchoice: "2"},
                                BETLEVELS: [
                                    {
                                        BETLEVEL: [{$: {currency: "EUR", values: "0.1,0.5,1,2,5"}}, {$: {currency: "USD", values: "0.1,0.5,1,2,5,10"}}, {$: {currency: "SEK", values: "0.01,0.05,0.1,0.5"}}],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
    });
    test("service api - getbetlevels - currency alias per brand", async () => {
        queueMockWalletResponse({data: {currencyList: [walletCurrencyAlias]}});
        queueMockWalletResponse({
            data: {
                availableBetsBulk: {
                    bets: {
                        "test-game": {
                            [walletCurrencyAlias]: ["1", "2"],
                        },
                    },
                },
            },
        });
        const params = {loginname: walletConfig.username, password: walletConfig.password, request: "getbetlevels", gpgameid: "test-game", opid: brandWithCurrencyAlias};
        const searchParams = new URLSearchParams(params).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);
        const {variables} = JSON.parse(mockedFetch.mock.calls[1][1]!.body as string);
        const json = await parseStringPromise(response.text, {valueProcessors: [parseNumbers]});

        expect(variables.currencies).toEqual([walletCurrencyAlias]);
        expect(variables.brand).toEqual(brandWithCurrencyAlias);
        expect(json).toEqual({
            RSP: {
                $: {rc: "0", request: "getbetlevels"},
                APIVERSION: [1.5],
                GAMES: [
                    {
                        GAME: [
                            {
                                $: {gamechoice: "false", gpgameid: "test-game", playerchoice: "2"},
                                BETLEVELS: [
                                    {
                                        BETLEVEL: [{$: {currency: walletCurrencyAlias.toUpperCase(), values: "1,2"}}],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
    });
    test("service api - getcriticalfiles", async () => {
        queueMockWalletResponse({
            data: {
                criticalFiles: {
                    items: [
                        {component: "test-game", name: "/critical/game/path/file1.txt", loggedChecksum: v4()},
                        {component: "test-game", name: "/critical/game/path/file2.txt", jurisdictions: ["it"], loggedChecksum: v4()},
                        {component: "test-game", name: "/critical/game/path2/file1.txt", jurisdictions: ["es", "se"], loggedChecksum: v4()},
                        {component: "test-game", name: "/critical/game/path2/file2.txt", loggedChecksum: v4()},
                        {component: "test-game2", name: "/critical/game/path/2/critical.json", jurisdictions: ["uk"], loggedChecksum: v4()},
                    ],
                },
            },
        });
        const params3 = {loginname: walletConfig.username, password: walletConfig.password, request: "getcriticalfiles", gpgameids: "123456,789012"};
        const searchParams = new URLSearchParams(params3).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);

        expect(response.body).toEqual({
            checksums: [
                {ogsgameid: "123456", filepath: "/critical/game/path", filename: "file2.txt", checksum: expect.any(String)},
                {ogsgameid: "123456", filepath: "/critical/game/path2", filename: "file1.txt", checksum: expect.any(String)},
                {ogsgameid: "789012", filepath: "/critical/game/path/2", filename: "critical.json", checksum: expect.any(String)},
            ],
        });
    });
    test("service api - getchecksumreport (it jurisdiction)", async () => {
        queueMockWalletResponse({
            data: {
                criticalFiles: {
                    items: [
                        {
                            component: "test-game",
                            name: "/critical/test-game/bundle.jar",
                            jurisdictions: ["it", "uk"],
                            declaredChecksum: "3a5f0be6d2c94ad35e23f20f1a0c4bb62d2b9c57",
                            loggedChecksum: "3a5f0be6d2c94ad35e23f20f1a0c4bb62d2b9c57",
                        },
                        {
                            component: "test-game",
                            name: "/critical/test-game/README.txt",
                            jurisdictions: ["it"],
                            declaredChecksum: "0d4f1b2c3e4a5968709bacdf13579ace2468bd12",
                            loggedChecksum: "8c1e0af7b2d945d90b63e5fd0c4a1f23e5ab7c91",
                        },
                        {
                            component: "test-game2",
                            name: "/critical/test-game2/other.jar",
                            jurisdictions: ["uk"],
                            declaredChecksum: "5f6a7b8c9d0e1f23456789abcdef0123456789ab",
                            loggedChecksum: "5f6a7b8c9d0e1f23456789abcdef0123456789ab",
                        },
                    ],
                },
            },
        });
        const params = {
            loginname: walletConfig.username,
            password: walletConfig.password,
            request: "getchecksumreport",
            jurisdiction: "it",
            opid: "casino",
            algorithmtype: "NGI_SHA1",
        };
        const searchParams = new URLSearchParams(params).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);

        expect(response.body).toEqual({
            RSP: {
                request: "getchecksumreport",
                rc: 0,
                apiversion: "1.5",
                report: {
                    algorithmType: "NGI_SHA1",
                    componentResults: [
                        {
                            componentId: "/critical/test-game/bundle.jar",
                            componentType: "NGI_software",
                            metadata: {
                                game: {
                                    name: "test-game",
                                    gpgameid: "123456",
                                },
                            },
                            verifyState: "NGI_complete",
                            verifyResult: "3a5f0be6d2c94ad35e23f20f1a0c4bb62d2b9c57",
                        },
                        {
                            componentId: "/critical/test-game/README.txt",
                            componentType: "NGI_software",
                            metadata: {
                                game: {
                                    name: "test-game",
                                    gpgameid: "123456",
                                },
                            },
                            verifyState: "NGI_error",
                            verifyResult: "8c1e0af7b2d945d90b63e5fd0c4a1f23e5ab7c91",
                        },
                    ],
                },
            },
        });
    });
    test("service api - getchecksumreport (uk jurisdiction)", async () => {
        queueMockWalletResponse({
            data: {
                criticalFiles: {
                    items: [
                        {
                            component: "test-game",
                            name: "/critical/test-game/bundle.jar",
                            jurisdictions: ["it", "uk"],
                            declaredChecksum: "3a5f0be6d2c94ad35e23f20f1a0c4bb62d2b9c57",
                            loggedChecksum: "3a5f0be6d2c94ad35e23f20f1a0c4bb62d2b9c57",
                        },
                        {
                            component: "test-game",
                            name: "/critical/test-game/README.txt",
                            jurisdictions: ["it"],
                            declaredChecksum: "0d4f1b2c3e4a5968709bacdf13579ace2468bd12",
                            loggedChecksum: "8c1e0af7b2d945d90b63e5fd0c4a1f23e5ab7c91",
                        },
                        {
                            component: "test-game2",
                            name: "/critical/test-game2/other.jar",
                            jurisdictions: ["uk"],
                            declaredChecksum: "5f6a7b8c9d0e1f23456789abcdef0123456789ab",
                            loggedChecksum: "5f6a7b8c9d0e1f23456789abcdef0123456789ab",
                        },
                    ],
                },
            },
        });
        const params = {
            loginname: walletConfig.username,
            password: walletConfig.password,
            request: "getchecksumreport",
            jurisdiction: "uk",
            opid: "casino",
            algorithmtype: "NGI_SHA1",
        };
        const searchParams = new URLSearchParams(params).toString();
        const response = await request(api).get(`/wallet/lnw-wallet/service-api/?${searchParams}`).expect(200);

        expect(response.body).toEqual({
            RSP: {
                request: "getchecksumreport",
                rc: 0,
                apiversion: "1.5",
                report: {
                    algorithmType: "NGI_SHA1",
                    componentResults: [
                        {
                            componentId: "/critical/test-game/bundle.jar",
                            componentType: "NGI_software",
                            metadata: {
                                game: {
                                    name: "test-game",
                                    gpgameid: "123456",
                                },
                            },
                            verifyState: "NGI_complete",
                            verifyResult: "3a5f0be6d2c94ad35e23f20f1a0c4bb62d2b9c57",
                        },
                        {
                            componentId: "/critical/test-game2/other.jar",
                            componentType: "NGI_software",
                            metadata: {
                                game: {
                                    name: "test-game2",
                                    gpgameid: "789012",
                                },
                            },
                            verifyState: "NGI_complete",
                            verifyResult: "5f6a7b8c9d0e1f23456789abcdef0123456789ab",
                        },
                    ],
                },
            },
        });
    });
});
