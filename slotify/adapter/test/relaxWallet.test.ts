import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
import fetch, {fetchAndParse, Response} from "@slotify/shared/lib/fetch";
import * as crypto from "crypto";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {Rgs} from "../db/model/Rgs";
import {URLSearchParams} from "url";
import {Game} from "../db/model/Game";
import {v4} from "uuid";
import {deepObjectAssign} from "@slotify/shared/lib/deepObjectAssign";
import {Transaction} from "../db/model/Transaction";
import {Player} from "../db/model/Player";
import {gql} from "graphql-request";
import {normalizeWhitespaces} from "../util/gql";
import wait from "@slotify/shared/lib/wait";
import {getWalletAdapter} from "../walletAdapter/walletAdapter";
import RelaxWalletAdapter from "../walletAdapter/RelaxWalletAdapter";
import {CurrencyAlias} from "../db/model/CurrencyAlias";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";

const rgsConfig = {
    secretKey: "secret-rgs-key",
    realUrl: "https://cdn.test-provider.tech?server=https://test-provider.tech",
    replayUrl: "https://cdn.test-provider.tech?server=https://test-provider.tech",
};

const rgsHeader = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

const walletConfig = {
    url: "https://dev-p2p-cdn.api.relaxg.net/p2p/v2",
    user: "pns",
    password: "test",
    platformCode: "tequity",
    providers: {
        "test-provider": {
            code: "tp",
            name: "Test Provider",
        },
    },
    cancelDelay: 0,
};

const TESTS_TIMEOUT = 300000;

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Wallet.create({id: "relax-wallet", adapter: "relax", config: walletConfig, ips: ["127.0.0.1", "::ffff:127.0.0.1"]}).save();
    await Game.create({game: "test-game", title: "Test Game", provider: "test-provider", rgs: "test-rgs"}).save();

    await CurrencyAlias.create({currency: "eur", alias: "gc-1000000", multiplier: 0}).save();
    await CurrencyAlias.create({currency: "eur", alias: "gc-default", multiplier: 0}).save();
    await CurrencyAlias.create({currency: "eur", alias: "sc-default", multiplier: 0}).save();
    await CurrencyAlias.create({currency: "eur", alias: "sc-100", multiplier: 0}).save();
    await CurrencyAlias.create({currency: "eur", alias: "gc-2000", multiplier: 0}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "gc-1000000", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "gc-default", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "sc-default", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "sc-100", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "gc-2000", rate: 1, date: new Date()}).save();
    await Wallet.create({
        id: "currencies-aliases-relax-wallet",
        adapter: "relax",
        config: {
            ...walletConfig,
            currencyAliases: {"GC.": "gc-default", "SC": "sc-default"},
            currencyAliasesPerBrand: {"GC.": {"10": "gc-1000000", "20": "gc-2000"}, "SC": {"10": "sc-100"}},
        },
    }).save();

    api = await initService();
}, TESTS_TIMEOUT);

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const queueMockFetchResponse = (responseBody: any, status: number = 200): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(responseBody), {status}) as Response));
};

const mockedFetchAndParse = fetchAndParse as jest.MockedFunction<typeof fetchAndParse>;
const queueMockFetchAndParseResponse = (responseBody: any): void => {
    mockedFetchAndParse.mockReturnValueOnce(Promise.resolve(responseBody));
};

afterEach(() => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();
});

function verifyRequestHeaders(requestParams: any) {
    expect(requestParams?.method).toEqual("POST");
    expect(requestParams?.headers).toEqual({
        "Content-Type": "application/json",
        "Authorization": expect.any(String),
    });
}

function createWalletHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(walletConfig.user + ":" + walletConfig.password).toString("base64"),
    };
}

function createLauncherQuery() {
    return {
        "gameid": "test-game",
        "ticket": "4cbd68da3f4a4158a5539cf83597f93e",
        "lang": "en_GB",
        "channel": "web",
        "partnerid": 10,
        "game-id": "test-game",
        "moneymode": "real",
        "clientid": "android",
        "homeurl": "https://relax-lobby.url",
    };
}

async function launcherRequest(): Promise<string> {
    const response = await request(api).get("/wallet/relax-wallet/launcher").query(createLauncherQuery());

    const [, paramsUrl] = response.headers.location.split("?");
    const searchParams = new URLSearchParams(paramsUrl);

    return searchParams.get("key")!;
}

function authenticateRequest(key: string, verifyTokenResponseParams: any = {}): request.Test {
    const verifyPlayerResponse = {
        playerid: 106893,
        customerid: "customer-id",
        countrycode: "GB",
        currency: "EUR",
        jurisdiction: "UK",
        balance: 26447,
        sessionid: 53447,
        partnerid: 10,
        clientid: "client-id",
    };
    deepObjectAssign(verifyPlayerResponse, verifyTokenResponseParams);

    queueMockFetchResponse(verifyPlayerResponse);
    queueMockFetchAndParseResponse({data: {campaigns: {items: []}}});

    const authenticateRequestParams = {
        wallet: "relax-wallet",
        operator: "test-operator",
        key,
        provider: "test-provider",
        game: "test-game",
    };
    return request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authenticateRequestParams)).send(authenticateRequestParams);
}

function getTransactionResponse(
    authenticateResponse: request.Response,
    transactionRequestParams: any = {},
    transactionWalletResponseParams: any = {},
    transactionWalletStatus: number = 200,
    transactionRequestToOverride: any = null,
    transactionWalletRequestToOverride: any = null,
): request.Test {
    const transactionWalletResponse = {
        sessionid: 51876,
        balance: 100001,
        relaxtxid: 22463433,
        txid: "759091",
    };
    deepObjectAssign(transactionWalletResponse, transactionWalletResponseParams);
    queueMockFetchResponse(transactionWalletRequestToOverride || transactionWalletResponse, transactionWalletStatus);

    const transactionRequest = {
        amount: 123.45,
        type: "withdraw",
        provider: "test-provider",
        game: "test-game",
        rgsTransactionId: "rgs-transaction-id-withdraw-" + v4(),
        roundId: "round-id-" + v4(),
        playerId: authenticateResponse.body.playerId,
    };
    deepObjectAssign(transactionRequest, transactionRequestParams);

    return request(api)
        .put("/rgs/test-rgs/transaction")
        .set(rgsHeader(transactionRequestToOverride || transactionRequest))
        .send(transactionRequestToOverride || transactionRequest);
}

describe("relax wallet adapter", () => {
    test(
        "launcher - redirect successful",
        async () => {
            const response = await request(api).get("/wallet/relax-wallet/launcher").query(createLauncherQuery()).expect(302);

            const [baseUrl, paramsUrl] = response.headers.location.split("?");
            const searchParams = new URLSearchParams(paramsUrl);

            expect(baseUrl).toEqual("https://cdn.test-provider.tech");
            expect(searchParams.get("server")).toEqual("https://test-provider.tech");
            expect(searchParams.get("wallet")).toEqual("relax-wallet");
            expect(searchParams.get("operator")).toEqual("relax");
            expect(searchParams.get("provider")).toEqual("test-provider");
            expect(searchParams.get("language")).toEqual("en_GB");
            expect(searchParams.get("lobbyUrl")).toEqual("https://relax-lobby.url");
            expect(searchParams.get("key")).toEqual(expect.any(String));
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate - successful",
        async () => {
            const key = await launcherRequest();
            const response = await authenticateRequest(key).expect(200);

            expect(response.body).toEqual({
                nativeId: "106893",
                jurisdiction: "uk",
                currency: "eur",
                country: "gb",
                brand: "10",
                nickname: "customer-id",
                balance: 264.47,
                playerId: expect.any(String),
                sessionId: expect.any(String),
                sessionData: expect.any(Object),
            });

            // verify authenticate call
            const [url, requestParams] = mockedFetch.mock.calls[0];
            expect(url).toEqual(walletConfig.url + "/10/verifytoken");
            verifyRequestHeaders(requestParams);
            expect(JSON.parse(requestParams?.body as string)).toEqual({
                "channel": "web",
                "clientid": "android",
                "gameref": "rlx.tequity.tp.test-game",
                "partnerid": 10,
                "requestid": expect.any(String),
                "timestamp": expect.any(Number),
                "token": expect.any(String),
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate - bet limits mapping",
        async () => {
            const key = await launcherRequest();
            const response = await authenticateRequest(key, {
                operatorbetsettings: {
                    minimumbet: 100,
                    maximumbet: 200,
                    defaultbet: 150,
                },
            }).expect(200);

            expect(response.body).toEqual({
                nativeId: "106893",
                jurisdiction: "uk",
                currency: "eur",
                country: "gb",
                brand: "10",
                nickname: "customer-id",
                balance: 264.47,
                playerId: expect.any(String),
                sessionId: expect.any(String),
                sessionData: {
                    channel: "web",
                    clientid: "android",
                    sessionid: 53447,
                    betConfig: {
                        minBet: 1,
                        maxBet: 2,
                        maxBonusBet: 2,
                        defaultBet: 1.5,
                    },
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "withdraw - successful",
        async () => {
            const key = await launcherRequest();
            const authenticateResponse = await authenticateRequest(key);

            const transactionResponse = await getTransactionResponse(authenticateResponse).expect(200);

            expect(transactionResponse.body).toEqual({balance: 1000.01});

            // verify withdraw call
            const [url, requestParams] = mockedFetch.mock.calls[1];
            expect(url).toEqual(walletConfig.url + "/10/withdraw");
            verifyRequestHeaders(requestParams);
        },
        TESTS_TIMEOUT,
    );

    test(
        "withdraw - insufficient funds",
        async () => {
            const key = await launcherRequest();
            const authenticateResponse = await authenticateRequest(key);
            const transactionWalletResponse = {
                errorcode: "INSUFFICIENT_FUNDS",
            };

            const transactionResponse = await getTransactionResponse(authenticateResponse, undefined, undefined, 400, undefined, transactionWalletResponse);

            expect(transactionResponse.body).toEqual({
                error: {
                    message: "Application Error",
                    code: "INSUFFICIENT_FUNDS",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "withdraw rollback - unique request params",
        async () => {
            const key = await launcherRequest();
            const authenticateResponse = await authenticateRequest(key);

            const transactionWalletResponse = {
                errorcode: "UNHANDLED",
            };

            queueMockFetchResponse(transactionWalletResponse, 503);

            const transactionRequest = {
                amount: 123.45,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw-" + v4(),
                roundId: "round-id-" + v4(),
                playerId: authenticateResponse.body.playerId,
            };

            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(transactionRequest)).send(transactionRequest);

            const [, originalRequestParams] = mockedFetch.mock.calls[1];
            const originalBody = JSON.parse(originalRequestParams?.body as string);

            await wait(10);

            const cancelRequest = {rgsTransactionId: transactionRequest.rgsTransactionId};
            await request(api).delete("/rgs/test-rgs/cancel").set(rgsHeader(cancelRequest)).send(cancelRequest);

            expect(mockedFetch.mock.calls.length).toEqual(3);

            const [, requestParams] = mockedFetch.mock.calls[2];

            const rollbackBody = JSON.parse(requestParams?.body as string);

            expect(rollbackBody.originaltxid).toEqual(originalBody.txid);
            expect(rollbackBody.txid).toEqual("rollback_" + originalBody.txid);
            expect(rollbackBody.requestid).not.toEqual(originalBody.requestid);
            expect(rollbackBody.timestamp).not.toEqual(originalBody.timestamp);
        },
        TESTS_TIMEOUT,
    );

    test(
        "deposit retry - identical request params",
        async () => {
            const key = await launcherRequest();
            const authenticateResponse = await authenticateRequest(key);

            const transactionRequestParams = {roundId: v4()};
            await getTransactionResponse(authenticateResponse, transactionRequestParams);

            const transactionWalletResponse = {
                errorcode: "UNHANDLED",
            };
            for (let i = 0; i < 2; i++) {
                queueMockFetchResponse(transactionWalletResponse, 503);
            }

            const transactionRequest = {
                amount: 123.45,
                type: "deposit",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-deposit-" + v4(),
                roundId: transactionRequestParams.roundId,
                playerId: authenticateResponse.body.playerId,
            };

            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(transactionRequest)).send(transactionRequest);
            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(transactionRequest)).send(transactionRequest);

            await wait(500);

            const [, originalRequestParams] = mockedFetch.mock.calls[2];
            const originalBody = JSON.parse(originalRequestParams?.body as string);

            const [, requestParams] = mockedFetch.mock.calls[3];

            const currentBody = JSON.parse(requestParams?.body as string);

            expect(currentBody.txid).toEqual(originalBody.txid);
            expect(currentBody.requestid).not.toEqual(originalBody.requestid);
            expect(currentBody.timestamp).toEqual(originalBody.timestamp);
        },
        TESTS_TIMEOUT,
    );

    test(
        "transaction - custom error",
        async () => {
            const key = await launcherRequest();
            const authenticateResponse = await authenticateRequest(key);

            const transactionWalletResponse = {
                errorcode: "CUSTOM_ERROR",
                errorparameters: {
                    errorCode: 403,
                    errorDetails: {
                        buttontext: "Custom error button text",
                        message: "Custom error message",
                        title: "Custom error title",
                    },
                    errorMessage: "CUSTOM_ERROR",
                },
            };
            const transactionResponse = await getTransactionResponse(authenticateResponse, undefined, undefined, 403, undefined, transactionWalletResponse);

            expect(transactionResponse.body).toEqual({
                error: {
                    message: "Application Error",
                    code: "TRANSACTION_FAILED",
                    payload: {errorparameters: transactionWalletResponse.errorparameters},
                    popups: [
                        {
                            title: "Custom error title",
                            message: "Custom error message",
                            buttons: [
                                {
                                    action: "exit",
                                    label: "Custom error button text",
                                },
                            ],
                        },
                    ],
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "cancel - successful",
        async () => {
            const key = await launcherRequest();
            const authenticateResponse = await authenticateRequest(key);

            const transactionRequestParams = {
                rgsTransactionId: "rgs-transaction-id-to-cancel-" + v4(),
                roundId: v4(),
            };
            await getTransactionResponse(authenticateResponse, transactionRequestParams);

            const rollbackWalletResponse = {
                relaxtxid: 69889940,
                sessionid: 199480,
                txid: "rollback_" + transactionRequestParams.rgsTransactionId,
            };
            queueMockFetchResponse(rollbackWalletResponse);

            const balanceWalletResponse = {
                balance: 99500,
                currency: "EUR",
                sessionid: 199465,
            };
            queueMockFetchResponse(balanceWalletResponse);

            const cancelRequest = {rgsTransactionId: transactionRequestParams.rgsTransactionId};
            const cancelResponse = await request(api).delete("/rgs/test-rgs/cancel").set(rgsHeader(cancelRequest)).send(cancelRequest).expect(200);

            expect(cancelResponse.body).toEqual({balance: 995});

            // verify rollback call
            const [, walletTransactionCall] = mockedFetch.mock.calls[1];
            const transactionWalletCall = JSON.parse(walletTransactionCall?.body as string);

            const [url, requestParams] = mockedFetch.mock.calls[2];
            expect(url).toEqual(walletConfig.url + "/10/rollback");

            verifyRequestHeaders(requestParams);

            expect(JSON.parse(requestParams?.body as string)).toEqual({
                "amount": 12345,
                "clientid": "android",
                "currency": "EUR",
                "ended": null,
                "gameref": "rlx.tequity.tp.test-game",
                "originaltimestamp": expect.any(Number),
                "originaltxid": transactionWalletCall.txid,
                "playerid": 106893,
                "requestid": expect.any(String),
                "roundid": transactionRequestParams.roundId,
                "sessionid": transactionWalletCall.sessionid,
                "timestamp": expect.any(Number),
                "txid": "rollback_" + transactionWalletCall.txid,
                "txtype": "withdraw",
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "balance - successful",
        async () => {
            const key = await launcherRequest();

            const authenticateResponse = await authenticateRequest(key);

            const balanceWalletResponse = {
                balance: 99500,
                currency: "EUR",
                sessionid: 199465,
            };
            queueMockFetchResponse(balanceWalletResponse);

            const balanceRequest = {
                provider: "test-provider",
                game: "test-game",
                playerId: authenticateResponse.body.playerId,
            };

            const balanceResponse = await request(api).get("/rgs/test-rgs/balance").set(rgsHeader({})).query(balanceRequest).expect(200);

            expect(balanceResponse.body).toEqual({balance: 995});

            // verify balance call
            const [url, requestParams] = mockedFetch.mock.calls[1];
            expect(url).toEqual(walletConfig.url + "/10/getbalance");
            verifyRequestHeaders(requestParams);

            expect(JSON.parse(requestParams?.body as string)).toEqual({
                "currency": "EUR",
                "gameref": "rlx.tequity.tp.test-game",
                "playerid": 106893,
                "requestid": expect.any(String),
                "sessionid": expect.any(Number),
                "timestamp": expect.any(Number),
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "replay - successful",
        async () => {
            const player = await Player.insert({nativeId: v4(), operator: "relax", currency: "SEK", wallet: "relax"});
            const playerId = player.raw[0].id;

            const roundId = v4();
            const earliestTransaction = await Transaction.insert({playerId, roundId, amount: 1.01, balanceAfter: 1, type: "withdraw", status: "finished", game: "test-game", provider: "test-provider", auto: false});
            await Transaction.insert({playerId, roundId, amount: 1, balanceAfter: 0, type: "withdraw", status: "finished", game: "test-game", provider: "test-provider", auto: false});
            const latestTransaction = await Transaction.insert({playerId, roundId, amount: 1234, balanceAfter: 1235, type: "deposit", status: "finished", game: "test-game", provider: "test-provider", auto: false});

            const replayRequest = {
                credentials: {
                    partnerid: 3,
                    src: "backoffice",
                    bouser: "example.user@example.com",
                },
                roundid: roundId,
                locale: "sv_SE",
            };

            const response = await request(api).post("/wallet/relax-wallet/replay/get").set(createWalletHeaders()).send(replayRequest).expect(200);

            const [baseUrl, paramsUrl] = response.body.replayurl.split("?");
            const searchParams = new URLSearchParams(paramsUrl);

            expect(baseUrl).toEqual("https://cdn.test-provider.tech");
            expect(searchParams.get("server")).toEqual("https://test-provider.tech");
            expect(searchParams.get("operator")).toEqual("relax");
            expect(searchParams.get("provider")).toEqual("test-provider");
            expect(searchParams.get("language")).toEqual("sv");

            expect(response.body).toEqual({
                replayurl: expect.any(String),
                roundstart: new Date(earliestTransaction.raw[0].createdAt).toISOString().split(".")[0] + "Z",
                roundend: new Date(latestTransaction.raw[0].createdAt).toISOString().split(".")[0] + "Z",
                betamount: 201,
                winamount: 123400,
                currency: "SEK",
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "getround - successful",
        async () => {
            const playerId = v4();
            const roundId = v4();
            await Transaction.insert({playerId, roundId, amount: 1.01, balanceAfter: 1, type: "withdraw", status: "finished", game: "test-game", provider: "test-provider", auto: false});
            const depositTransaction = await Transaction.insert({playerId, roundId, amount: 1234, balanceAfter: 1235, type: "deposit", status: "finished", game: "test-game", provider: "test-provider", auto: false});

            const getStateRequest = {
                roundid: roundId,
            };

            const response = await request(api).post("/wallet/relax-wallet/round/getstate").set(createWalletHeaders()).send(getStateRequest).expect(200);

            expect(response.body).toEqual({
                closedtime: new Date(depositTransaction.raw[0].createdAt).toISOString().split(".")[0] + "Z",
                gameref: "rlx.tequity.tp.test-game",
                totalwinamount: 123400,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "freespins add - successful",
        async () => {
            const addCampaignRequest = {
                amount: 1,
                credentials: {
                    bouser: null,
                    partnerid: 10,
                    src: "partnerapi",
                },
                currency: "EUR",
                expires: "2053-12-20T13:36:32Z",
                freespinvalue: 100,
                gameref: "rlx.pns.pns.robin-not",
                partnerid: 10,
                playerid: 85131,
                promocode: "RELAX_CAMPAIGN_1",
                txid: 4138,
            };

            queueMockFetchResponse({data: {addCampaign: v4()}});
            const response = await request(api).post("/wallet/relax-wallet/freespins/add").set(createWalletHeaders()).send(addCampaignRequest).expect(200);

            expect(response.body).toEqual({
                freespinsid: expect.any(String),
                txid: 4138,
            });

            const query = normalizeWhitespaces(gql`
                mutation ($data: CampaignInput!) {
                    addCampaign(data: $data)
                }
            `);

            const variables = {
                data: {
                    type: "freeBets",
                    config: {amount: 1, bets: 1, currency: "eur"},
                    end: 2649850592000,
                    games: ["robin-not"],
                    name: "relax_4138_RELAX_CAMPAIGN_1",
                    nativeIds: ["85131"],
                    wallets: ["relax-wallet"],
                    brands: ["10"],
                },
            };

            expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({account: {}, query, variables});
        },
        TESTS_TIMEOUT,
    );

    test(
        "games get - successful",
        async () => {
            const addCampaignRequest = {
                credentials: {
                    bouser: null,
                    partnerid: 10,
                    src: "partnerapi",
                },
            };

            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"test-game": {eur: [1, 2, 3, 4]}}}}});
            const response = await request(api).post("/wallet/relax-wallet/games/getgames").set(createWalletHeaders()).send(addCampaignRequest).expect(200);

            expect(response.body).toEqual({
                games: [
                    {
                        channels: ["web", "mobile"],
                        freespins: {
                            channels: ["web", "mobile"],
                            types: ["regular"],
                        },
                        gameref: "rlx.tequity.tp.test-game",
                        legalbetsizes: [100, 200, 300, 400],
                        name: "Test Game",
                        studio: "Test Provider",
                    },
                ],
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate with campaigns - successful",
        async () => {
            process.env.PROMO_SERVICE_HOST = "localhost";
            process.env.PROMO_SERVICE_PORT = "1234";
            const key = await launcherRequest();

            const verifyPlayerResponse = {
                playerid: 106893,
                customerid: "customer-id",
                countrycode: "GB",
                currency: "EUR",
                jurisdiction: "UK",
                balance: 26447,
                sessionid: 53447,
                partnerid: 10,
                clientid: "client-id",
                promotions: [
                    {
                        promotiontype: "freerounds",
                        promotionid: 242,
                        txid: "dev-242-85220",
                        playerid: 85220,
                        partnerid: 10,
                        gameref: "rlx.pns.pns.barbarossa",
                        amount: 5,
                        freespinvalue: 100,
                        expires: "2054-02-05T09:09:52Z",
                        promocode: "1706519017",
                    },
                ],
            };
            queueMockFetchResponse(verifyPlayerResponse);
            queueMockFetchAndParseResponse({data: {campaigns: {items: []}}});
            queueMockFetchResponse({data: {addCampaign: "test-campaign-id"}});
            queueMockFetchResponse({promotions_statuses: [{status: "ack", txid: "dev-242-85220"}]});

            const authenticateRequestParams = {
                wallet: "relax-wallet",
                operator: "test-operator",
                key,
                provider: "test-provider",
                game: "test-game",
            };
            await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authenticateRequestParams)).send(authenticateRequestParams).expect(200);

            // verify authenticate call
            const [url, requestParams] = mockedFetch.mock.calls[2];
            expect(url).toEqual(walletConfig.url + "/10/ackpromotionadd");
            verifyRequestHeaders(requestParams);
            expect(JSON.parse(requestParams?.body as string)).toEqual({
                "promotions": [
                    {
                        "data": {
                            "channel": "web",
                            "freespinsid": "test-campaign-id",
                        },
                        "playerid": 85220,
                        "promotionid": 242,
                        "txid": "dev-242-85220",
                    },
                ],
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "finalize - successful",
        async () => {
            const key = await launcherRequest();
            const authenticateResponse = await authenticateRequest(key);

            const transactionRequestParams = {roundId: v4()};
            await getTransactionResponse(authenticateResponse, transactionRequestParams);

            const finalizeRequest = {
                freespinvalue: 100,
                sessionid: 199480,
                roundid: transactionRequestParams.roundId,
            };
            const finalizeResponse = await request(api).post("/wallet/relax-wallet/finalize").set(createWalletHeaders()).send(finalizeRequest).expect(200);
            expect(finalizeResponse.body).toEqual({finalizedstatus: "OK", sessionid: 199480});

            const walletAdapter = (await getWalletAdapter("relax-wallet")) as RelaxWalletAdapter;
            await walletAdapter.finalizeRound(transactionRequestParams.roundId, 199480, 10);

            queueMockFetchResponse({finalizedstatus: "FINALIZED"}, 200);
            const balanceWalletResponse = {
                balance: 99500,
                currency: "EUR",
                sessionid: 199465,
            };
            queueMockFetchResponse(balanceWalletResponse);

            const transactionRequest = {
                amount: 13,
                type: "deposit",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-deposit-" + v4(),
                roundId: transactionRequestParams.roundId,
                playerId: authenticateResponse.body.playerId,
            };

            const finalizeTransactionResponse = await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(transactionRequest)).send(transactionRequest);
            expect(finalizeTransactionResponse.body).toEqual({balance: 995, promo: expect.any(Object)});

            const [finalizeRoundUrl, finalizeRoundRequest] = mockedFetch.mock.calls[2];
            expect(finalizeRoundUrl).toEqual("https://dev-p2p-cdn.api.relaxg.net/p2p/v2/10/finalizeround");
            expect(JSON.parse(finalizeRoundRequest!.body as string)).toEqual({
                finalizedstatus: "FINALIZED",
                roundid: transactionRequest.roundId,
                sessionid: 53447,
                depositdata: {
                    amount: 1300,
                    betamount: 12345,
                    channel: "web",
                    clientid: "android",
                    currency: "EUR",
                    gameref: "rlx.tequity.tp.test-game",
                    playerid: 106893,
                    requestid: expect.any(String),
                    roundid: transactionRequest.roundId,
                    sessionid: 53447,
                    timestamp: expect.any(Number),
                    txid: expect.any(String),
                    txtype: "deposit",
                    replayurl: expect.any(String),
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "currency alias mapping",
        async () => {
            const response = await request(api).get("/wallet/currencies-aliases-relax-wallet/launcher").query(createLauncherQuery());

            const [, paramsUrl] = response.headers.location.split("?");
            const searchParams = new URLSearchParams(paramsUrl);

            const key = searchParams.get("key")!;

            const verifyPlayerResponse = {
                playerid: 10000,
                countrycode: "GB",
                currency: "GC.",
                jurisdiction: "UK",
                balance: 26447,
                sessionid: 10000,
                partnerid: 10,
            };
            queueMockFetchResponse(verifyPlayerResponse);
            queueMockFetchAndParseResponse({data: {campaigns: {items: []}}});

            const authenticateRequestParams = {
                wallet: "currencies-aliases-relax-wallet",
                operator: "test-operator",
                key,
                provider: "test-provider",
                game: "test-game",
            };
            const authenticateResponse = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authenticateRequestParams)).send(authenticateRequestParams);

            expect(authenticateResponse.body.currency).toEqual("gc-1000000");

            const transactionWalletResponse = {
                sessionid: 10000,
                balance: 100001,
                relaxtxid: 10000,
                txid: "759091",
            };
            queueMockFetchResponse(transactionWalletResponse, 200);

            const transactionRequest = {
                amount: 123.45,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw-" + v4(),
                roundId: "round-id-" + v4(),
                playerId: authenticateResponse.body.playerId,
            };
            const transactionResponse = await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(transactionRequest)).send(transactionRequest);

            expect(transactionResponse.body).toEqual({balance: 1000.01, promo: expect.any(Object)});

            const player = await Player.findOneByOrFail({id: transactionRequest.playerId});
            expect(player.currency).toEqual("gc-1000000");

            const [, requestParams] = mockedFetch.mock.calls[1];
            expect(JSON.parse(requestParams!.body as string).currency).toEqual("GC.");
        },
        TESTS_TIMEOUT,
    );

    test.each([
        ["USD", "10", "usd"],
        ["GC.", "10", "gc-1000000"],
        ["GC.", "20", "gc-2000"],
        ["GC.", undefined, "gc-default"],
        ["GC.", "30", "gc-default"],
        ["SC", "10", "sc-100"],
        ["SC", "30", "sc-default"],
        ["SC", undefined, "sc-default"],
        [undefined, "10", "eur"],
        [undefined, undefined, "eur"],
    ])("fromRelaxCurrency(%s, %s) - priority: currencyAliasesPerBrand > currencyAliases > original", async (relaxCurrency?: string, brand?: string, currency?: string) => {
        const walletAdapter = (await getWalletAdapter("currencies-aliases-relax-wallet")) as RelaxWalletAdapter;
        expect(walletAdapter.fromRelaxCurrency(relaxCurrency, brand)).toEqual(currency);
    });

    test.each([
        ["USD", "10", "usd"],
        ["GC.", "10", "gc."],
        ["GC.", undefined, "gc."],
        [undefined, "10", "eur"],
        [undefined, undefined, "eur"],
    ])("no currency aliases wallet fromRelaxCurrency(%s, %s)", async (relaxCurrency?: string, brand?: string, currency?: string) => {
        const walletAdapter = (await getWalletAdapter("relax-wallet")) as RelaxWalletAdapter;
        expect(walletAdapter.fromRelaxCurrency(relaxCurrency, brand)).toEqual(currency);
    });

    test.each([
        ["usd", "10", "USD"],
        ["gc-1000000", "10", "GC."],
        ["gc-1000000", "20", "GC-1000000"],
        ["gc-2000", "20", "GC."],
        ["gc-2000", undefined, "GC-2000"],
        ["gc-default", "30", "GC."],
        ["gc-default", undefined, "GC."],
        ["sc-default", "30", "SC"],
        ["sc-default", undefined, "SC"],
        ["sc-100", "10", "SC"],
    ])("toRelaxCurrency(%s, %s) - priority: currencyAliasesPerBrand > currencyAliases > original", async (currency: string, brand?: string, relaxCurrency?: string) => {
        const walletAdapter = (await getWalletAdapter("currencies-aliases-relax-wallet")) as RelaxWalletAdapter;
        expect(walletAdapter.toRelaxCurrency(currency, brand)).toEqual(relaxCurrency);
    });

    test(
        "currency alias fallback - authenticate and transaction",
        async () => {
            const launcherQueryWithBrand30 = {...createLauncherQuery(), partnerid: 30};
            const response = await request(api).get("/wallet/currencies-aliases-relax-wallet/launcher").query(launcherQueryWithBrand30);

            const [, paramsUrl] = response.headers.location.split("?");
            const searchParams = new URLSearchParams(paramsUrl);

            const key = searchParams.get("key")!;

            const verifyPlayerResponse = {
                playerid: 10001,
                countrycode: "GB",
                currency: "SC",
                jurisdiction: "UK",
                balance: 26447,
                sessionid: 10001,
                partnerid: 30,
            };
            queueMockFetchResponse(verifyPlayerResponse);
            queueMockFetchAndParseResponse({data: {campaigns: {items: []}}});

            const authenticateRequestParams = {
                wallet: "currencies-aliases-relax-wallet",
                operator: "test-operator",
                key,
                provider: "test-provider",
                game: "test-game",
            };
            const authenticateResponse = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authenticateRequestParams)).send(authenticateRequestParams);

            expect(authenticateResponse.body.currency).toEqual("sc-default");

            const transactionWalletResponse = {
                sessionid: 10001,
                balance: 100001,
                relaxtxid: 10001,
                txid: "759092",
            };
            queueMockFetchResponse(transactionWalletResponse, 200);

            const withdrawRequest = {
                amount: 50,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw-" + v4(),
                roundId: "round-id-" + v4(),
                playerId: authenticateResponse.body.playerId,
            };
            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawRequest)).send(withdrawRequest);

            const player = await Player.findOneByOrFail({id: withdrawRequest.playerId});
            expect(player.currency).toEqual("sc-default");

            const [, requestParams] = mockedFetch.mock.calls[1];
            expect(JSON.parse(requestParams!.body as string).currency).toEqual("SC");

            queueMockFetchResponse({...transactionWalletResponse, balance: 100051}, 200);

            const depositRequest = {
                amount: 100,
                type: "deposit",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-deposit-" + v4(),
                roundId: withdrawRequest.roundId,
                playerId: authenticateResponse.body.playerId,
            };
            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(depositRequest)).send(depositRequest);

            const [, depositRequestParams] = mockedFetch.mock.calls[2];
            expect(JSON.parse(depositRequestParams!.body as string).currency).toEqual("SC");
        },
        TESTS_TIMEOUT,
    );
});
