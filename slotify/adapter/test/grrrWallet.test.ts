import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
import fetch, {Response} from "@slotify/shared/lib/fetch";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {Rgs} from "../db/model/Rgs";
import {URLSearchParams} from "url";
import {Game} from "../db/model/Game";
import {Express} from "express";
import * as crypto from "crypto";
import {deepObjectAssign} from "@slotify/shared/lib/deepObjectAssign";
import {normalizeWhitespaces} from "../util/gql";
import {gql} from "graphql-request";
import {IConfig} from "../walletAdapter/GrrrWalletAdapter";
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

const walletConfig: IConfig = {
    brands: {
        "ninecasino": {url: "https://dev.aramuz.net/walletapi/ninecasino", secretKey: "testKey"},
        "winaura": {url: "https://dev.aramuz.net/walletapi/winaura", secretKey: "testKey2"},
    },
    providerPartnerId: "shadylady",
    thumbnailUrl: "https://dupa.com/${game}/thumbnail.png",
};

const TESTS_TIMEOUT = 30000;

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Wallet.create({
        id: "grrr-wallet",
        adapter: "grrr",
        config: walletConfig,
        ips: ["127.0.0.1", "::ffff:127.0.0.1"],
    }).save();
    await Game.create({game: "test-game", title: "Test Game", provider: "test-provider", rgs: "test-rgs"}).save();
    await Game.create({game: "dice", title: "Dice", provider: "tequity", rgs: "test-rgs"}).save();
    await Game.create({game: "dragon-tower", provider: "tequity", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    api = await initService();
}, TESTS_TIMEOUT * 2);

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const queueMockFetchResponse = (responseBody: any, status: number = 200): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(responseBody), {status}) as Response));
};

afterEach(() => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();
});

function createLauncherQuery(partnerId?: string) {
    return {
        partnerId: partnerId || "ninecasino",
        gameId: "test-game",
        token: "testToken",
        currency: "EUR",
        lang: "en",
        platform: "mobile",
        demo: "0",
        returnUrl: "example.com",
    };
}

function createAuthenticateRequestAndResponse(
    key: string,
    initResponseParams: any = {},
): {
    requestParams: any;
    responseParams: any;
} {
    const defaultInitResponseParams = {
        token: "testToken",
        playerId: "1111111",
        currency: "EUR",
        balance: "2000.00",
    };
    deepObjectAssign(defaultInitResponseParams, initResponseParams);

    const authenticateRequestParams = {
        wallet: "grrr-wallet",
        operator: "test-operator",
        key,
        provider: "test-provider",
        game: "test-game",
    };
    return {requestParams: authenticateRequestParams, responseParams: defaultInitResponseParams};
}

async function launcherRequest(partnerId?: string): Promise<string[]> {
    const response = await request(api).get("/wallet/grrr-wallet/launcher").query(createLauncherQuery(partnerId)).expect(302);
    return response.headers.location.split("?");
}

async function authenticateRequest(expectedResponseCode: number = 200, partnerId: string = "ninecasino") {
    const key = await getLauncherRequestKey(partnerId);

    const {requestParams, responseParams} = createAuthenticateRequestAndResponse(key);
    queueMockFetchResponse(responseParams);

    return request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(requestParams)).send(requestParams).expect(expectedResponseCode);
}

async function getLauncherRequestKey(partnerId?: string): Promise<string> {
    const [, paramsUrl] = await launcherRequest(partnerId);
    const searchParams = new URLSearchParams(paramsUrl);

    return searchParams.get("key")!;
}

describe("grrr wallet adapter", () => {
    test(
        "launcher - redirect successful",
        async () => {
            const [baseUrl, paramsUrl] = await launcherRequest();
            const searchParams = new URLSearchParams(paramsUrl);

            expect(baseUrl).toEqual("https://cdn.test-provider.tech");
            expect(searchParams.get("server")).toEqual("https://test-provider.tech");
            expect(searchParams.get("wallet")).toEqual("grrr-wallet");
            expect(searchParams.get("operator")).toEqual("grrr");
            expect(searchParams.get("provider")).toEqual("test-provider");
            expect(searchParams.get("language")).toEqual("en");
            expect(searchParams.get("lobbyUrl")).toEqual("example.com");
            expect(searchParams.get("key")).toEqual(expect.any(String));
        },
        TESTS_TIMEOUT,
    );

    test(
        "List of games -  successful",
        async () => {
            const response = await request(api)
                .get("/wallet/grrr-wallet/api")
                .query({
                    partnerId: "ninecasino",
                    action: "gameList",
                })
                .expect(200);

            const gamesList: any[] = response.body;
            expect(gamesList.length).toEqual(3);
            expect(gamesList[0]).toEqual({
                id: "test-game",
                name: "Test Game",
                type: "otherGames",
                image: "https://dupa.com/test-game/thumbnail.png",
            });
            expect(gamesList[1]).toEqual({
                id: "dice",
                name: "Dice",
                type: "otherGames",
                image: "https://dupa.com/dice/thumbnail.png",
            });
            expect(gamesList[2]).toEqual({
                id: "dragon-tower",
                name: "dragon-tower",
                type: "otherGames",
                image: "https://dupa.com/dragon-tower/thumbnail.png",
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "List of games -  unsuccessful invalid action",
        async () => {
            await request(api)
                .get("/wallet/grrr-wallet/api")
                .query({
                    partnerId: "ninecasino",
                    action: "notGameList",
                })
                .expect(404);
        },
        TESTS_TIMEOUT,
    );

    test(
        "freeSpins add - successful",
        async () => {
            const addCampaignRequest = {
                partnerId: "ninecasino",
                action: "activateFreeSpin",
                freeSpinId: "40358995175524",
                playerId: "909124789158235",
                currency: "EUR",
                amount: 50,
                games: ["dice"],
                expireAt: "2053-12-20T13:36:32Z",
            };

            queueMockFetchResponse({data: {addCampaign: "0001010101010"}});
            await request(api).post("/wallet/grrr-wallet/action").set(rgsHeader(addCampaignRequest)).send(addCampaignRequest).expect(200);

            const query = normalizeWhitespaces(gql`
                mutation ($data: CampaignInput!) {
                    addCampaign(data: $data)
                }
            `);

            const variables = {
                data: {
                    type: "freeBets",
                    config: {amount: 0.2, bets: 50, currency: "eur"},
                    end: 2649850592000,
                    games: ["dice"],
                    name: "grrr-wallet_40358995175524",
                    nativeIds: ["909124789158235"],
                    wallets: ["grrr-wallet"],
                    brands: ["ninecasino"],
                },
            };

            expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({account: {}, query, variables});
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate - successful",
        async () => {
            const response = await authenticateRequest();

            expect(response.body).toEqual({
                nativeId: "1111111",
                currency: "eur",
                balance: 2000.0,
                brand: "ninecasino",
                playerId: expect.any(String),
                sessionId: expect.any(String),
            });

            // verify authenticate call
            const [url, calledRequestParams] = mockedFetch.mock.calls[0];
            expect(url).toEqual(walletConfig.brands["ninecasino"].url + "/action/");
            expect(calledRequestParams?.method).toEqual("POST");
            expect(calledRequestParams?.headers).toEqual({
                "Content-Type": "application/json",
                "Signature": expect.any(String),
            });
            expect(JSON.parse(calledRequestParams?.body as string)).toEqual({
                token: "testToken",
                partnerId: "shadylady",
                action: "init",
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate - different brand successful",
        async () => {
            const response = await authenticateRequest(undefined, "winaura");

            expect(response.body).toEqual({
                nativeId: "1111111",
                currency: "eur",
                balance: 2000.0,
                brand: "winaura",
                playerId: expect.any(String),
                sessionId: expect.any(String),
            });

            // verify authenticate call
            const [url, calledRequestParams] = mockedFetch.mock.calls[0];
            expect(url).toEqual(walletConfig.brands["winaura"].url + "/action/");
            expect(JSON.parse(calledRequestParams?.body as string)).toEqual({
                token: "testToken",
                partnerId: "shadylady",
                action: "init",
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate - unsuccessful, player not found",
        async () => {
            const key = await getLauncherRequestKey();

            const {requestParams, responseParams} = createAuthenticateRequestAndResponse(key, {errorCode: "10001"});
            queueMockFetchResponse(responseParams);

            const response = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(requestParams)).send(requestParams).expect(200);

            expect(response.body).toEqual({
                error: {
                    message: "Application Error",
                    code: "PLAYER_UNAUTHORIZED",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "transaction - withdraw successful",
        async () => {
            const authenticateResponse = await authenticateRequest();

            queueMockFetchResponse({balance: 1999.99});

            const withdrawParams = {
                amount: 0.45,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw",
                roundId: "round-id1",
                playerId: authenticateResponse.body.playerId,
            };
            const response = await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

            expect(response.body).toEqual({
                balance: 1999.99,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "transaction - withdraw unsuccessful, insufficient funds",
        async () => {
            const authenticateResponse = await authenticateRequest();

            queueMockFetchResponse({errorCode: "10002"});

            const withdrawParams = {
                amount: 0.45,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw-insufficient-funds",
                roundId: "round-id2",
                playerId: authenticateResponse.body.playerId,
            };
            const response = await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

            expect(response.body).toEqual({
                error: {
                    message: "Application Error",
                    code: "INSUFFICIENT_FUNDS",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "transaction - free bets deposit successful",
        async () => {
            const authenticateResponse = await authenticateRequest();

            queueMockFetchResponse({data: {campaignPlayers: {items: [{finished: true, state: {totalWin: 5}}]}}});
            queueMockFetchResponse({data: {campaigns: {items: [{name: "grrr-wallet_10230190312"}]}}});
            queueMockFetchResponse({balance: 2005});

            const freeBetsParams = {
                amount: 0,
                type: "deposit",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-deposit-free-bets-finished",
                roundId: "round-id5",
                playerId: authenticateResponse.body.playerId,
                category: "promo",
                campaignType: "freeBets",
                campaignId: "7818349123",
            };
            const response = await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(freeBetsParams)).send(freeBetsParams).expect(200);

            expect(response.body).toEqual({
                balance: 2005,
            });

            expect(JSON.parse(mockedFetch.mock.calls[3][1]?.body as string)).toEqual({
                partnerId: "shadylady",
                action: "freeSpin",
                freeSpinId: "10230190312",
                amount: "5",
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "transaction - free bets unfinished balance return",
        async () => {
            const authenticateResponse = await authenticateRequest();

            queueMockFetchResponse({data: {campaignPlayers: {items: [{finished: false, state: {totalWin: 5}}]}}});
            queueMockFetchResponse({balance: 2000});

            const freeBetsParams = {
                amount: 0,
                type: "deposit",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-deposit-free-bets-unfinished",
                roundId: "round-id4",
                playerId: authenticateResponse.body.playerId,
                category: "promo",
                campaignType: "freeBets",
                campaignId: "7818349123",
            };
            const response = await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(freeBetsParams)).send(freeBetsParams).expect(200);

            expect(response.body).toEqual({
                balance: 2000,
            });

            expect(JSON.parse(mockedFetch.mock.calls[2][1]?.body as string)).toEqual({
                partnerId: "shadylady",
                action: "balance",
                playerId: authenticateResponse.body.nativeId,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "cancel - successful",
        async () => {
            const authenticateResponse = await authenticateRequest();

            queueMockFetchResponse({balance: 1998.99});

            const withdrawParams = {
                amount: 1.01,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw-cancellable",
                roundId: "round-id3",
                playerId: authenticateResponse.body.playerId,
            };
            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

            queueMockFetchResponse({balance: 2000.0});

            const cancelParams = {rgsTransactionId: "rgs-transaction-id-withdraw-cancellable"};

            const cancelResponse = await request(api).delete("/rgs/test-rgs/cancel").set(rgsHeader(cancelParams)).send(cancelParams).expect(200);

            expect(cancelResponse.body).toEqual({
                balance: 2000,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "balance - successful",
        async () => {
            const authenticateResponse = await authenticateRequest();

            queueMockFetchResponse({balance: 2500});

            const response = await request(api)
                .get(
                    "/rgs/test-rgs/balance?" +
                        new URLSearchParams({
                            playerId: authenticateResponse.body.playerId,
                            provider: "test-provider",
                            game: "test-game",
                        }),
                )
                .set(rgsHeader({}))
                .expect(200);

            expect(response.body).toEqual({
                balance: 2500,
            });
        },
        TESTS_TIMEOUT,
    );
});
