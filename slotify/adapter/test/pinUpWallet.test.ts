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
import {IConfig} from "../walletAdapter/PinUpWalletAdapter";
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

const authHeader = () => {
    return {"Authorization": "testSecretKey"};
};

const walletConfig: IConfig = {
    url: "https://dev.pinup.net/walletapi",
    providerId: "tequity",
    providerToken: "providerTestToken",
    secretKey: "testSecretKey",
};

const TESTS_TIMEOUT = 30000;

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Wallet.create({
        id: "pinup-dev",
        adapter: "pinup",
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

function createLauncherBody() {
    return {
        demo: false,
        isMobile: false,
        gameId: "test-game",
        playerId: "1111111",
        lang: "en",
        token: "testToken",
        home: "example.com",
        currency: "EUR",
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
        userName: "xxx_Killer_xxx777",
        token: "testToken",
        playerId: "1111111",
        currency: "EUR",
        balance: "2000.00",
    };
    deepObjectAssign(defaultInitResponseParams, initResponseParams);

    const authenticateRequestParams = {
        wallet: "pinup-dev",
        operator: "test-operator",
        key,
        provider: "test-provider",
        game: "test-game",
    };
    return {requestParams: authenticateRequestParams, responseParams: defaultInitResponseParams};
}

async function launcherRequest(): Promise<string[]> {
    const response = await request(api).post("/wallet/pinup-dev/partner/tequity/gameWebFrame").set(authHeader()).send(createLauncherBody()).expect(200);
    return response.body.URL.split("?");
}

async function authenticateRequest(expectedResponseCode: number = 200) {
    const key = await getLauncherRequestKey();

    const {requestParams, responseParams} = createAuthenticateRequestAndResponse(key);
    queueMockFetchResponse(responseParams);

    return request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(requestParams)).send(requestParams).expect(expectedResponseCode);
}

async function getLauncherRequestKey(): Promise<string> {
    const [, paramsUrl] = await launcherRequest();
    const searchParams = new URLSearchParams(paramsUrl);

    return searchParams.get("key")!;
}

describe("pinup wallet adapter", () => {
    test(
        "launcher - redirect successful",
        async () => {
            const [baseUrl, paramsUrl] = await launcherRequest();
            const searchParams = new URLSearchParams(paramsUrl);

            expect(baseUrl).toEqual("https://cdn.test-provider.tech");
            expect(searchParams.get("server")).toEqual("https://test-provider.tech");
            expect(searchParams.get("wallet")).toEqual("pinup-dev");
            expect(searchParams.get("operator")).toEqual("pinup");
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
            queueMockFetchResponse({data: {campaigns: {items: []}}});
            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"test-game": {"eur": [0.25, 0.5, 0.75, 1]}}}}});
            queueMockFetchResponse({data: {campaigns: {items: [{name: "pinup-dev_10230190312", campaignId: "1010100101"}]}}});
            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"dice": {"eur": [2, 5, 100]}}}}});
            queueMockFetchResponse({data: {campaigns: {items: []}}});
            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"dragon-tower": {"eur": [0.01, 0.02, 1.5, 10.52]}}}}});

            const response = await request(api).get("/wallet/pinup-dev/partner/tequity/games").set(authHeader()).expect(200);

            expect(response.body.provider).toEqual("tequity");
            const gamesList: any[] = response.body.gameList;
            expect(gamesList.length).toEqual(3);
            expect(gamesList[0]).toEqual({
                gameId: "test-game",
                title: "Test Game",
                betFactors: [25, 50, 75, 100],
                freespinAvailable: false,
            });
            expect(gamesList[1]).toEqual({
                gameId: "dice",
                title: "Dice",
                betFactors: [200, 500, 10000],
                freespinAvailable: true,
            });
            expect(gamesList[2]).toEqual({
                gameId: "dragon-tower",
                title: "dragon-tower",
                betFactors: [1, 2, 150, 1052],
                freespinAvailable: false,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "List of games -  successful, one of them doesnt have real provider",
        async () => {
            queueMockFetchResponse({data: {campaigns: {items: []}}});
            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"test-game": {"eur": [0.25, 0.5, 0.75, 1]}}}}});
            queueMockFetchResponse({data: {campaigns: {items: [{name: "pinup-dev_10230190312", campaignId: "1010100101"}]}}});
            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"dice": {"eur": [2, 5, 100]}}}}});
            queueMockFetchResponse({data: {campaigns: {items: []}}});
            queueMockFetchResponse({errors: [{message: "Provider Doesnt exist"}]});

            const response = await request(api).get("/wallet/pinup-dev/partner/tequity/games").set(authHeader()).expect(200);

            const gamesList: any[] = response.body.gameList;
            expect(gamesList.length).toEqual(3);
            expect(gamesList[0]).toEqual({
                gameId: "test-game",
                title: "Test Game",
                betFactors: [25, 50, 75, 100],
                freespinAvailable: false,
            });
            expect(gamesList[1]).toEqual({
                gameId: "dice",
                title: "Dice",
                betFactors: [200, 500, 10000],
                freespinAvailable: true,
            });
            expect(gamesList[2]).toEqual({
                gameId: "dragon-tower",
                title: "dragon-tower",
                betFactors: [],
                freespinAvailable: false,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "freeSpins add - successful",
        async () => {
            const addCampaignRequest = {
                freespinId: "40358995175524",
                playerId: "909124789158235",
                name: "dice",
                currency: "EUR",
                betAmount: 2,
                games: ["dice"],
                spinAmount: 50,
                expireDate: "2053-12-20T13:36:32Z",
            };

            queueMockFetchResponse({data: {addCampaign: "0001010101010"}});
            const response = await request(api).post("/wallet/pinup-dev/partner/tequity/freespin").set(authHeader()).send(addCampaignRequest).expect(200);

            expect(response.body.id).toEqual("40358995175524");
            const query = normalizeWhitespaces(gql`
                mutation ($data: CampaignInput!) {
                    addCampaign(data: $data)
                }
            `);

            const variables = {
                data: {
                    type: "freeBets",
                    config: {amount: 0.02, bets: 50, currency: "eur"},
                    end: 2649850592000,
                    games: ["dice"],
                    name: "pinup-dev_40358995175524",
                    nativeIds: ["909124789158235"],
                    wallets: ["pinup-dev"],
                },
            };

            expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({account: {}, query, variables});
        },
        TESTS_TIMEOUT,
    );

    test(
        "freeSpins add without betFactor specified - successful",
        async () => {
            const addCampaignRequest = {
                freespinId: "40358995175524",
                playerId: "909124789158235",
                name: "dice",
                currency: "EUR",
                betAmount: 0,
                games: ["dice"],
                spinAmount: 50,
                expireDate: "2053-12-20T13:36:32Z",
            };

            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"dice": {"eur": [0.8, 0.25, 0.5, 0.75, 1]}}}}});
            queueMockFetchResponse({data: {addCampaign: "0001010101010"}});
            const response = await request(api).post("/wallet/pinup-dev/partner/tequity/freespin").set(authHeader()).send(addCampaignRequest).expect(200);

            expect(response.body.id).toEqual("40358995175524");
            const query = normalizeWhitespaces(gql`
                mutation ($data: CampaignInput!) {
                    addCampaign(data: $data)
                }
            `);

            const variables = {
                data: {
                    type: "freeBets",
                    config: {amount: 0.25, bets: 50, currency: "eur"},
                    end: 2649850592000,
                    games: ["dice"],
                    name: "pinup-dev_40358995175524",
                    nativeIds: ["909124789158235"],
                    wallets: ["pinup-dev"],
                },
            };

            expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({account: {}, query, variables});
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
                playerId: expect.any(String),
                sessionId: expect.any(String),
                nickname: "xxx_Killer_xxx777",
                brand: "tequity",
            });

            // verify authenticate call
            const [url, calledRequestParams] = mockedFetch.mock.calls[0];
            expect(url).toEqual(walletConfig.url + "/tequity/session?token=providerTestToken&sessionId=testToken&playerId=1111111&gameId=test-game");
            expect(calledRequestParams?.method).toEqual("GET");
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate - unsuccessful, player not found",
        async () => {
            const key = await getLauncherRequestKey();

            const {requestParams, responseParams} = createAuthenticateRequestAndResponse(key, {errCode: 9, errMessage: "player not found"});
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

            // verify transaction call
            const [url, calledRequestParams] = mockedFetch.mock.calls[1];
            expect(url).toEqual(walletConfig.url + "/tequity/action?token=providerTestToken");
            expect(calledRequestParams?.method).toEqual("POST");

            //verify transaction body

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

            queueMockFetchResponse({errCode: 7});

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
            queueMockFetchResponse({data: {campaigns: {items: [{name: "pinup-dev_10230190312"}]}}});
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
                transactionId: expect.any(String),
                freespinId: "10230190312",
                sessionId: "testToken",
                playerId: "1111111",
                gameId: "test-game",
                gameRoundId: expect.any(String),
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

            const [url, calledRequestParams] = mockedFetch.mock.calls[2];
            expect(url).toEqual(walletConfig.url + "/tequity/session?token=providerTestToken&sessionId=testToken&playerId=1111111&gameId=test-game");
            expect(calledRequestParams?.method).toEqual("GET");
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
