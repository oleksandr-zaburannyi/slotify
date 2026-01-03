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
import {Player} from "../db/model/Player";
import {v4} from "uuid";
import {Game} from "../db/model/Game";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";

const walletConfig = {
    brands: {
        "test-casino-id": {
            url: "https://example.com/api/tequity",
            token: "secret-key",
        },
    },
    convertCurrencies: {
        btc: "ubtc",
        eth: "meth",
        bnb: "mbnb",
        ltc: "mltc",
    },
};

const rgsConfig = {
    secretKey: "secret-rgs-key",
    realUrl: "https://cdn.test-provider.tech?game=${game}&server=https://test-provider.tech&wallet=${wallet}&operator=${operator}&key=${key}",
    funUrl: "https://cdn.test-provider.tech?game=${game}&server=https://test-provider.tech&operator=${operator}&wallet=demo",
};

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Wallet.create({id: "a8r", adapter: "softswiss2", config: walletConfig}).save();
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Rgs.create({id: "test-rgs-without-urls", adapter: "standard", config: {secretKey: "secret-rgs-key"}}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "pln", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "jpy", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "ubtc", rate: 1, date: new Date()}).save();
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const queueMockWalletResponse = (response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(response)) as Response));
};

const mockedFetchAndParse = fetchAndParse as jest.MockedFunction<typeof fetchAndParse>;
const queueMockPlatformServiceResponse = (response: any): void => {
    mockedFetchAndParse.mockReturnValueOnce(Promise.resolve(response));
};

afterEach(() => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();
});

describe("softswiss2 wallet adapter", () => {
    const softSwissWalletHeader = (params: any, key: string = "secret-key") => {
        const body = params ? JSON.stringify(params) : "";
        const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
        return {"x-request-sign": hmac};
    };

    const header = (params: any, key: string = "secret-rgs-key") => {
        const body = params ? JSON.stringify(params) : "";
        const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
        return {"x-server-authorization": hmac};
    };

    function verifyWalletRequestHeaders(requestParams: any) {
        return expect.objectContaining({
            "Content-Type": "application/json",
            "x-request-sign": crypto.createHmac("sha256", "secret-key").update(requestParams!.body!.toString()).digest("hex"),
        });
    }

    function createSessionRequestParams(options: Partial<{game: string; nativeUserId: string; currency: string}> = {}) {
        return {
            casino_id: "test-casino-id",
            game: options.game || "test-game",
            locale: "en",
            session_id: "SID",
            ip: "128.0.0.1",
            client_type: "desktop",
            urls: {
                return_url: "https://test-casino.com/lobby",
                deposit_url: "https://test-casino.com/deposit",
            },
            account: {
                country: "PL",
                currency: options.currency || "PLN",
                date_of_birth: "2000-01-01",
                firstname: "test-player-firstname",
                gender: "f",
                id: options.nativeUserId || "test-player-native-id",
                lastname: "test-player-lastname",
                nickname: "test-player-nickname",
                registered_at: "2020-12-31",
            },
            jurisdiction: "CA-ON",
        };
    }

    function sessionRequest(params: any): request.Test {
        return request(api).post("/wallet/a8r/v2/a8r_provider.Launcher/Real").set(softSwissWalletHeader(params)).send(params);
    }

    function createAuthenticateRequestParams(key?: string | null, options: Partial<{wallet: string}> = {}) {
        return {
            wallet: options.wallet || "a8r",
            operator: "test-operator",
            key: key,
            provider: "test-provider",
            game: "test-game",
        };
    }

    function authenticateRequest(params: any): request.Test {
        return request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params);
    }

    async function sessionsAndAuthenticate(
        options: Partial<{
            nativeUserId: string;
            nativeBalance: number;
            currency: string;
        }> = {},
    ): Promise<request.Test> {
        const sessionRequestParams = createSessionRequestParams(options);
        const sessionRequestResponse = await sessionRequest(sessionRequestParams);

        const paramsUrl = sessionRequestResponse.body.launch_url.split("?")[1];
        const key = new URLSearchParams(paramsUrl).get("key");

        queueMockWalletResponse({balance: options.nativeBalance});
        const authenticateRequestParams: any = createAuthenticateRequestParams(key);
        return authenticateRequest(authenticateRequestParams);
    }

    test("launch real request - successful", async () => {
        const sessionRequestParams = createSessionRequestParams();
        const response = await sessionRequest(sessionRequestParams).expect(200);

        const [, paramsUrl] = response.body.launch_url.split("?");
        const searchParams = new URLSearchParams(paramsUrl);

        expect(searchParams.get("game")).toEqual("test-game");
        expect(searchParams.get("server")).toEqual("https://test-provider.tech");
        expect(searchParams.get("wallet")).toEqual("a8r");
        expect(searchParams.get("operator")).toEqual("softswiss");
        expect(searchParams.get("language")).toEqual("en");
        expect(searchParams.get("lobbyUrl")).toEqual("https://test-casino.com/lobby");
        expect(searchParams.get("depositUrl")).toEqual("https://test-casino.com/deposit");
        expect(searchParams.get("key")).toEqual(expect.any(String));
    });

    test("sessions request - no secretKey", async () => {
        const sessionRequestParams = createSessionRequestParams();
        await request(api).post("/wallet/a8r/v2/a8r_provider.Launcher/Real").send(sessionRequestParams).expect(403);
    });

    test("sessions request - wrong secretKey", async () => {
        const sessionRequestParams = createSessionRequestParams();
        await request(api).post("/wallet/a8r/v2/a8r_provider.Launcher/Real").set(softSwissWalletHeader(sessionRequestParams, "wrong-secret-key")).send(sessionRequestParams).expect(403);
    });

    test("sessions request - preserve currency", async () => {
        const sessionRequestParams1 = createSessionRequestParams();
        await sessionsAndAuthenticate({...sessionRequestParams1, nativeBalance: 100});

        const sessionRequestParams2 = createSessionRequestParams({currency: "EUR"});
        await sessionsAndAuthenticate({...sessionRequestParams2, nativeBalance: 100});

        expect(await Player.findOneBy({nativeId: "test-player-native-id_pln"})).toHaveProperty("currency", "pln");
    });

    test("sessions request - 0 decimal currency support", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({
            nativeUserId: "jpy-test-player-native-id",
            nativeBalance: 1000000,
            currency: "JPY",
        });
        expect(authenticateResponse.body).toEqual(
            expect.objectContaining({
                currency: "jpy",
                balance: 1000000,
            }),
        );
    });

    test("sessions request - non existing currency error", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({
            nativeUserId: "xxx-test-player-native-id",
            nativeBalance: 100000000,
            currency: "XXX",
        });

        expect(authenticateResponse.body).toEqual(expect.objectContaining({error: {message: "Application Error", code: "CURRENCY_NOT_SUPPORTED"}}));
    });

    test("sessions request - no game urls error", async () => {
        const sessionRequestParams = createSessionRequestParams({game: "non-existing-game"});
        const sessionRequestResponse = await sessionRequest(sessionRequestParams).expect(400);

        expect(sessionRequestResponse.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });

    test("authenticate - successful", async () => {
        const sessionRequestParams = createSessionRequestParams();
        const sessionRequestResponse = await sessionRequest(sessionRequestParams);

        const paramsUrl = sessionRequestResponse.body.launch_url.split("?")[1];
        const key = new URLSearchParams(paramsUrl).get("key");

        const walletBalanceResponse = {
            game_id: "native-game-round-id",
            balance: 1.23,
        };
        queueMockWalletResponse(walletBalanceResponse);

        // verify wallet response
        const params: any = createAuthenticateRequestParams(key);
        const response = await authenticateRequest(params).expect(200);

        const expectedAuthenticateResponse = {
            nativeId: "test-player-native-id_pln",
            currency: "pln",
            country: "pl",
            nickname: "test-player-nickname",
            gender: "f",
            brand: "test-casino-id",
            jurisdiction: "ca-on",
            balance: 1.23,
            playerId: expect.any(String),
            sessionId: expect.any(String),
            sessionData: {
                sessionId: "SID",
            },
        };
        expect(response.body).toEqual(expectedAuthenticateResponse);

        // verify player in database
        const player = {
            ...expectedAuthenticateResponse,
            balance: undefined,
            playerId: undefined,
            id: expect.any(String),
            currency: "pln",
            operator: "test-operator",
            wallet: "a8r",
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            blocked: null,
            sessionId: undefined,
            group: null,
            sessionData: undefined,
        };
        expect(await Player.findOneBy({nativeId: "test-player-native-id_pln"})).toEqual(player);

        // verify wallet call
        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://example.com/api/tequity/v2/provider_a8r.Player/Balance");
        expect(requestParams).toEqual({
            method: "POST",
            body: expect.any(String),
            headers: verifyWalletRequestHeaders(requestParams),
            timeout: 15000,
        });
    });

    test("authenticate - wrong key", async () => {
        const sessionRequestParams = createSessionRequestParams();
        await sessionRequest(sessionRequestParams);

        const params: any = createAuthenticateRequestParams("wrong-key");
        const response = await authenticateRequest(params).expect(400);

        expect(response.body).toEqual({
            error: {
                message: "Application Error",
                code: "APPLICATION_ERROR",
            },
        });
    });

    test("authenticate - expired key", async () => {
        const tempDateNow = Date.now;
        Date.now = jest.fn(() => 1487076708000);
        const sessionRequestParams = createSessionRequestParams();
        const sessionRequestResponse = await sessionRequest(sessionRequestParams);
        Date.now = tempDateNow;

        const paramsUrl = sessionRequestResponse.body.launch_url.split("?")[1];
        const key = new URLSearchParams(paramsUrl).get("key");

        const params: any = createAuthenticateRequestParams(key);
        const response = await authenticateRequest(params).expect(400);

        expect(response.body).toEqual({
            error: {
                message: "Application Error",
                code: "APPLICATION_ERROR",
            },
        });
    });

    test("authenticate - non-existent player", async () => {
        const sessionRequestParams = createSessionRequestParams();
        const sessionRequestResponse = await sessionRequest(sessionRequestParams);

        await Player.delete({nativeId: "test-player-native-id"});

        const paramsUrl = sessionRequestResponse.body.launch_url.split("?")[1];
        const key = new URLSearchParams(paramsUrl).get("key");

        const params: any = createAuthenticateRequestParams(key);
        const response = await authenticateRequest(params).expect(400);

        expect(response.body).toEqual({
            error: {
                message: "Application Error",
                code: "UNKNOWN",
            },
        });
    });

    const createTransactionRequestParams = (playerId: string, amount: number, campaignType?: string, campaignId?: string, category?: string, type?: string) => ({
        amount: amount,
        type: type || (amount >= 0 ? "withdraw" : "deposit"),
        provider: "test-provider",
        game: "test-game",
        rgsTransactionId: "rgs-transaction-id-withdraw-" + v4(),
        roundId: v4(),
        playerId: playerId,
        jackpotAmount: amount,
        campaignType: campaignType,
        campaignId: campaignId,
        category,
    });

    function mockTransactionWalletResponse(nativeBalance: number) {
        mockedFetch.mockImplementationOnce((requestInfo, init) => {
            const requestBody: any = JSON.parse(init?.body as string);
            const transactions = requestBody.transactions?.map((t: any) => ({
                id_provider: t.id_provider,
                id: "native-transaction-id-" + Math.random(),
            }));

            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        round_id: requestBody.round_id_provider || requestBody.round_id,
                        balance: nativeBalance.toString(),
                        transactions: transactions,
                        id_provider: requestBody.id_provider,
                    }),
                ) as Response,
            );
        });
    }

    test("withdrawal - successful", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 78901, currency: "PLN"});
        const withdrawRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 111.01);
        mockTransactionWalletResponse(68900);

        await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawRequestParams)).send(withdrawRequestParams).expect(200);

        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://example.com/api/tequity/v2/provider_a8r.Round/BetWin");
        expect(requestParams).toEqual({
            method: "POST",
            body: expect.any(String),
            headers: verifyWalletRequestHeaders(requestParams),
            timeout: 15000,
        });

        expect(JSON.parse(requestParams!.body!.toString())).toEqual({
            currency: "PLN",
            game_id: "test-game",
            round_id: withdrawRequestParams.roundId,
            session_id: "SID",
            account_id: "test-player-native-id",
            transactions: expect.any(Array),
        });
    });

    test("withdrawal - insufficient funds", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 49, currency: "PLN"});
        const withdrawRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 0.5);
        mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({meta: {api_code: "100"}})) as Response));

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawRequestParams)).send(withdrawRequestParams).expect(400);

        expect(response.body).toEqual({
            error: {
                message: "Application Error",
                code: "INSUFFICIENT_FUNDS",
            },
        });
    });

    test("withdrawal - loss limit exceeded", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 49, currency: "PLN"});
        const withdrawRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 0.5);
        mockedFetch.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({meta: {api_code: "105"}})) as Response));

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawRequestParams)).send(withdrawRequestParams).expect(400);

        expect(response.body).toEqual({
            error: {
                message: "Application Error",
                code: "LOSS_LIMIT",
            },
        });
    });

    test("withdrawal - other wallet errors", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 49, currency: "PLN"});
        const withdrawRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 0.5);
        mockedFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({code: 107})) as Response));

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawRequestParams)).send(withdrawRequestParams).expect(400);

        expect(response.body).toEqual({
            error: {
                message: "Application Error",
                code: "TRANSACTION_FAILED",
            },
        });
    });

    test("withdrawal - duplicated rgsTransactionId", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 78900});
        mockedFetch.mockReset();

        const withdrawRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 100.01);
        withdrawRequestParams.rgsTransactionId = "rgs-transaction-id-withdraw-duplicated";
        mockTransactionWalletResponse(689.01);

        // transaction 1
        expect(mockedFetch.mock.calls.length).toEqual(0);
        const result1 = await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawRequestParams)).send(withdrawRequestParams).expect(200);
        expect(mockedFetch.mock.calls.length).toEqual(1);
        expect(result1.body).toEqual({balance: 689.01});

        // transaction 2 (doesn't trigger)
        expect(mockedFetch.mock.calls.length).toEqual(1);
        const result2 = await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawRequestParams)).send(withdrawRequestParams).expect(200);
        expect(mockedFetch.mock.calls.length).toEqual(1);
        expect(result2.body).toEqual({balance: 689.01});
    });

    test("withdrawal - cryptocurrency", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({
            nativeUserId: "ubtc-test-player-native-id",
            nativeBalance: 0.00000001,
            currency: "BTC",
        });
        expect(authenticateResponse.body).toEqual(
            expect.objectContaining({
                currency: "ubtc",
                balance: 0.01,
            }),
        );

        const withdrawRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 0.01); // ubtc value
        mockTransactionWalletResponse(1);
        const transactionResponse = await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawRequestParams)).send(withdrawRequestParams).expect(200);

        expect(transactionResponse.body).toEqual(
            expect.objectContaining({
                balance: 1000000,
            }),
        );
    });

    test("deposit - successful", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 99999, currency: "PLN"});
        const depositRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 0.01);
        mockTransactionWalletResponse(1000000);

        await request(api).put("/rgs/test-rgs/transaction").set(header(depositRequestParams)).send(depositRequestParams).expect(200);

        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://example.com/api/tequity/v2/provider_a8r.Round/BetWin");
        expect(requestParams).toEqual({
            method: "POST",
            body: expect.any(String),
            timeout: 15000,
            headers: verifyWalletRequestHeaders(requestParams),
        });

        expect(JSON.parse(requestParams!.body!.toString())).toEqual({
            account_id: "test-player-native-id",
            currency: "PLN",
            game_id: "test-game",
            round_id: depositRequestParams.roundId,
            session_id: "SID",
            transactions: [{type: "bet", amount: "0.01", id_provider: expect.any(String), jackpot_contribution: "0.01"}],
        });
    });

    test("cancel - successful", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 999999, currency: "PLN"});
        const depositRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 0.01);
        mockTransactionWalletResponse(1000000);

        await request(api).put("/rgs/test-rgs/transaction").set(header(depositRequestParams)).send(depositRequestParams);

        //cancel
        const cancelRequestParams = {provider: "test-provider", rgsTransactionId: depositRequestParams.rgsTransactionId};
        mockTransactionWalletResponse(999999);
        await request(api).delete("/rgs/test-rgs/cancel").set(header(cancelRequestParams)).send(cancelRequestParams).expect(200);

        //transaction request
        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://example.com/api/tequity/v2/provider_a8r.Round/Rollback");
        expect(requestParams).toEqual({
            body: expect.any(String),
            method: "POST",
            timeout: 15000,
            headers: verifyWalletRequestHeaders(requestParams),
        });

        expect(JSON.parse(requestParams?.body as string)).toEqual({
            account_id: "test-player-native-id",
            currency: "PLN",
            game_id: "test-game",
            round_id_provider: depositRequestParams.roundId,
            session_id: "SID",
            finished: true,
            transactions: [
                {
                    type: "rollback",
                    id_provider: expect.any(String),
                    original_id_provider: expect.any(String),
                },
            ],
        });
    });

    test("errors - returned wallet error", async () => {
        //sessions
        const sessionRequestParams = createSessionRequestParams();
        const sessionRequestResponse = await sessionRequest(sessionRequestParams);

        const paramsUrl = sessionRequestResponse.body.launch_url.split("?")[1];
        const key = new URLSearchParams(paramsUrl).get("key");

        //authenticate
        queueMockWalletResponse({code: "UNKNOWN"});
        queueMockWalletResponse({code: "UNKNOWN"});
        const params = {wallet: "a8r", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "TRANSACTION_FAILED", message: "Application Error"}});
    });

    test("errors - unexpected wallet error", async () => {
        //sessions
        const sessionRequestParams = createSessionRequestParams();
        const sessionRequestResponse = await sessionRequest(sessionRequestParams);

        const paramsUrl = sessionRequestResponse.body.launch_url.split("?")[1];
        const key = new URLSearchParams(paramsUrl).get("key");

        //authenticate
        mockedFetch.mockImplementation(() => {
            throw new Error();
        });
        const params = {wallet: "a8r", operator: "test-operator", key: key, provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "UNKNOWN", message: "Application Error"}});
    });

    test("demo", async () => {
        const demoRequestParams = {
            casino_id: "test-casino-id",
            game: "test-game",
            locale: "en",
            ip: "128.0.0.1",
            client_type: "desktop",
            urls: {return_url: "https://test-casino.com/lobby"},
            jurisdiction: "CA-ON",
        };

        const response = await request(api).post("/wallet/a8r/v2/a8r_provider.Launcher/Demo").set(softSwissWalletHeader(demoRequestParams)).send(demoRequestParams).expect(200);

        const [, paramsUrl] = response.body.launch_url.split("?");
        const searchParams = new URLSearchParams(paramsUrl);

        expect(searchParams.get("game")).toEqual("test-game");
        expect(searchParams.get("server")).toEqual("https://test-provider.tech");
        expect(searchParams.get("operator")).toEqual("softswiss");
        expect(searchParams.get("language")).toEqual("en");
        expect(searchParams.get("lobbyUrl")).toEqual("https://test-casino.com/lobby");
        expect(searchParams.get("wallet")).toEqual("demo");
    });

    test("demo - fun url not defined error", async () => {
        const demoRequestParams = {
            casino_id: "test-casino-id",
            game: "undefined-test-game",
            locale: "en",
            ip: "128.0.0.1",
            client_type: "desktop",
            urls: {return_url: "https://test-casino.com/lobby"},
            jurisdiction: "CA-ON",
        };

        const response = await request(api).post("/wallet/a8r/v2/a8r_provider.Launcher/Demo").set(softSwissWalletHeader(demoRequestParams)).send(demoRequestParams).expect(400);

        expect(response.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });

    function issueFreeSpins(
        options: Partial<{
            nativeIssueId: string;
            existingCampaigns: any[];
            games: any;
            availableBetsResponse: any;
            betLevel: number;
        }> = {},
    ): request.Test {
        const issueFreeSpinsParams = {
            casino_id: "test-casino-id",
            issue_id: options.nativeIssueId || "test-issue-id",
            games: options.games || ["test-game"],
            freespins_quantity: 10,
            bet_level: options.betLevel || 1,
            valid_until: "2023-01-18T20:03:19Z",
            account: {
                currency: "PLN",
                id: "test-player-native-id",
                firstname: "test-player-firstname",
                lastname: "test-player-lastname",
                nickname: "test-player-nickname",
                city: "test-player-city",
                date_of_birth: "2000-01-01",
                registered_at: "2020-12-31",
                registered: "test-player-date-of-birth",
                gender: "f",
                country: "PL",
            },
        };

        queueMockWalletResponse(options.availableBetsResponse || {data: {availableBetsBulk: {bets: {[options.games || "test-game"]: {eur: [1, 2, 3]}}}}});
        queueMockWalletResponse({data: {campaigns: {items: options.existingCampaigns || []}}});
        queueMockWalletResponse({data: {addCampaign: "abc"}});

        return request(api).post("/wallet/a8r/v2/a8r_provider.Freespins/Issue").set(softSwissWalletHeader(issueFreeSpinsParams)).send(issueFreeSpinsParams);
    }

    test("freespins - issue successful", async () => {
        const response = await issueFreeSpins().expect(200);

        expect(response.body).toEqual({});
    });

    test("freespins - wrong secret-key error", async () => {
        const issueFreeSpinsParams = {
            casino_id: "test-casino-id",
            issue_id: "test-issue-id",
        };

        const body = JSON.stringify(issueFreeSpinsParams);
        const hmac = crypto.createHmac("sha256", "wrong-secret-key").update(body).digest("hex");
        const header = {"x-request-sign": hmac};

        await request(api).post("/wallet/a8r/v2/a8r_provider.Freespins/Issue").set(header).send(issueFreeSpinsParams).expect(403);
    });

    test("freespins - campaign exists error", async () => {
        const response = await issueFreeSpins({
            nativeIssueId: "test-campaign",
            existingCampaigns: [{campaignId: "softswiss-api_test-campaign"}],
        }).expect(400);

        expect(response.body).toHaveProperty("msg", "Campaign named softswiss2-api_test-campaign already exists");
    });

    test("freespins - multiple games error", async () => {
        const response = await issueFreeSpins({
            games: ["test-game", "another-test-game"],
        }).expect(400);

        expect(response.body).toEqual(expect.objectContaining({error: {message: "Application Error", code: "APPLICATION_ERROR"}}));
    });

    test("freespins - wrong bet level errors", async () => {
        const response = await issueFreeSpins({
            betLevel: 4,
        }).expect(400);

        expect(response.body).toEqual(expect.objectContaining({error: {message: "Application Error", code: "APPLICATION_ERROR"}}));
    });

    test("freespins - wrong available bets response successful", async () => {
        const response = await issueFreeSpins({availableBetsResponse: {data: {availableBetsBulk: {bets: {other: {available: [13]}}}}}}).expect(400);

        expect(response.body).toEqual(expect.objectContaining({error: {message: "Application Error", code: "APPLICATION_ERROR"}}));
    });

    function cancelFreeSpins(
        options: Partial<{
            campaignsItems: any[];
        }> = {},
    ): request.Test {
        const cancelFreeSpinsParams = {
            issue_id: "test-issue-id",
            casino_id: "test-casino-id",
        };

        queueMockWalletResponse({data: {campaigns: {items: options.campaignsItems || [{campaignId: "campaign-id"}]}}});
        queueMockWalletResponse({data: {editCampaign: true}});

        return request(api).post("/wallet/a8r/v2/a8r_provider.Freespins/Cancel").set(softSwissWalletHeader(cancelFreeSpinsParams)).send(cancelFreeSpinsParams);
    }

    test("cancel freespins - successful", async () => {
        await cancelFreeSpins().expect(200);
    });

    test("cancel freespins - wrong secret-key error", async () => {
        const cancelFreeSpinsParams = {
            casino_id: "test-casino-id",
            issue_id: "test-issue-id",
        };

        const body = JSON.stringify(cancelFreeSpinsParams);
        const hmac = crypto.createHmac("sha256", "wrong-secret-key").update(body).digest("hex");
        const header = {"x-request-sign": hmac};

        await request(api).post("/wallet/a8r/v2/a8r_provider.Freespins/Cancel").set(header).send(cancelFreeSpinsParams).expect(403);
    });

    test("cancel freespins - non existing campaign", async () => {
        const response = await cancelFreeSpins({campaignsItems: []}).expect(400);

        expect(response.body).toHaveProperty("msg", "Couldn't find campaign named softswiss2-api_test-issue-id");
    });

    test("freespins transaction - ongoing campaign", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 1000000, currency: "PLN"});
        const transactionRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 1, "freeBets");

        queueMockWalletResponse({data: {campaignPlayers: {items: [{finished: false, state: {totalWin: 1000}}]}}});
        queueMockWalletResponse({balance: 1000000});
        queueMockPlatformServiceResponse({campaignType: "freeBets", campaignId: "test-campaign-id"});

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(transactionRequestParams)).send(transactionRequestParams).expect(200);

        expect(response.body).toEqual({balance: 1000000});

        let [url, requestParams] = mockedFetch.mock.calls[1]; // promo service graphQL call
        expect(url).toContain("/graphql");
        expect(requestParams).toEqual({
            body: expect.any(String),
            method: "POST",
            headers: expect.objectContaining({
                "Content-Type": "application/json",
            }),
        });

        [url, requestParams] = mockedFetch.mock.calls[2]; // balance call
        expect(url).toEqual("https://example.com/api/tequity/v2/provider_a8r.Player/Balance");
        expect(requestParams).toEqual({
            body: expect.any(String),
            method: "POST",
            timeout: 15000,
            headers: verifyWalletRequestHeaders(requestParams),
        });
    });

    test("freespins transaction - finished campaign", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 1000000, currency: "PLN"});
        const transactionRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 1, "freeBets", "test-campaign-id");

        queueMockWalletResponse({data: {campaignPlayers: {items: [{finished: true, state: {totalWin: 1000}}]}}});
        queueMockWalletResponse({data: {campaigns: {items: [{name: "campaign-name"}]}}});
        queueMockWalletResponse({balance: "1000000"});
        queueMockPlatformServiceResponse({campaignType: "freeBets", campaignId: "test-campaign-id"});

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(transactionRequestParams)).send(transactionRequestParams).expect(200);

        expect(response.body).toEqual({balance: 1000000});

        const [url, requestParams] = mockedFetch.mock.calls[3]; // balance call
        expect(url).toEqual("https://example.com/api/tequity/v2/provider_a8r.Freespins/Finish");
        expect(requestParams).toEqual({
            body: JSON.stringify({issue_id: "campaign-name", amount: "1000"}),
            method: "POST",
            timeout: 15000,
            headers: verifyWalletRequestHeaders(requestParams),
        });
    });

    test("freespins transaction - invalid response from promo service", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 1000000, currency: "PLN"});
        const transactionRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 1, "freeBets", "test-campaign-id");

        queueMockWalletResponse({data: {campaignPlayers: {items: [{finished: true, state: {totalWin: 1000000}}]}}});
        mockedFetch.mockReturnValueOnce(Promise.resolve(new Response() as Response));

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(transactionRequestParams)).send(transactionRequestParams).expect(400);

        expect(response.body).toEqual(expect.objectContaining({error: {message: "Application Error", code: "UNKNOWN"}}));
    });

    test("freespins transaction - deposit during campaign with player campaign state not present", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 1000000, currency: "PLN"});
        const transactionRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 1, "freeBets", "test-campaign-id");

        queueMockWalletResponse({});
        queueMockWalletResponse({balance: 1000000});

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(transactionRequestParams)).send(transactionRequestParams).expect(200);

        expect(response.body).toEqual({balance: 1000000});
    });

    test("freespins transaction - deposit during campaign with promo graphQL no response", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 1000000, currency: "PLN"});
        const transactionRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 1, "freeBets", "test-campaign-id");

        mockedFetch.mockReturnValueOnce(Promise.resolve(new Response() as Response));
        queueMockWalletResponse({balance: 1000000});

        const response = await request(api).put("/rgs/test-rgs/transaction").set(header(transactionRequestParams)).send(transactionRequestParams).expect(400);

        expect(response.body).toEqual({error: {code: "UNKNOWN", message: "Application Error"}});
    });

    test("promo win - successful", async () => {
        const authenticateResponse = await sessionsAndAuthenticate({nativeBalance: 99999, currency: "PLN"});
        const depositRequestParams = createTransactionRequestParams(authenticateResponse.body.playerId, 0.01, "prizeDrop", "c123", "promo", "deposit");
        mockTransactionWalletResponse(123.45);

        await request(api).put("/rgs/test-rgs/transaction").set(header(depositRequestParams)).send(depositRequestParams).expect(200);

        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://example.com/api/tequity/v2/provider_a8r.Promo/Win");
        expect(requestParams).toEqual({
            method: "POST",
            body: expect.any(String),
            timeout: 15000,
            headers: verifyWalletRequestHeaders(requestParams),
        });

        expect(JSON.parse(requestParams!.body!.toString())).toEqual({
            account_id: "test-player-native-id",
            amount: "0.01",
            currency: "PLN",
            event_type: "Prize Drop",
            id_provider: expect.any(String),
            event_id: depositRequestParams.campaignId,
        });
    });
});
