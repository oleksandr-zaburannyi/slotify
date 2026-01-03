import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
import fetch, {fetchAndParse, Response} from "@slotify/shared/lib/fetch";
import * as crypto from "crypto";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {v4} from "uuid";
import {Game} from "../db/model/Game";
import {cleanupAfterTests} from "./cleanup";
import {Rgs} from "../db/model/Rgs";

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    process.env.IS_PRODUCTION = "false";
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    const config = {url: "https://wallet.com", secretKey: "secret-key"};
    await Wallet.create({
        id: "standard-wallet",
        adapter: "standard",
        config,
        ips: ["127.0.0.1", "::ffff:127.0.0.1"],
    }).save();
    await Rgs.create({id: "internal-rgs", adapter: "standard", config: {}}).save();
    await Rgs.create({
        id: "external-rgs",
        adapter: "standard",
        config: {freeBetsUrl: "https://external-rgs", secretKey: "external-rgs-secret-key"},
    }).save();
    await Game.create({game: "internal-game", provider: "test-provider", rgs: "internal-rgs"}).save();
    await Game.create({game: "external-game", provider: "test-provider", rgs: "external-rgs"}).save();
    api = await initService();
});

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
    mockedFetch.mockReset();
    mockedFetchAndParse.mockReset();
});

const header = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

const TEST_TIMEOUT = 0;

describe("standard wallet free bets api", () => {
    test(
        "add free bets to internal promo",
        async () => {
            const params = {
                walletCampaignId: "test-wallet-campaign-id",
                games: ["internal-game"],
                nativeIds: ["test-native-player"],
                start: Date.now(),
                end: Date.now() + 24 * 60 * 60 * 1000,
                bets: 10,
                amount: 2,
                currency: "eur",
                operator: "my-operator",
                brand: "my-brand",
            };

            queueMockFetchResponse({data: {addCampaign: v4()}}, 200);

            const res = await request(api).post("/wallet/standard-wallet/freeBets/add").set(header(params, "secret-key")).send(params).expect(200);
            expect(res.body).toEqual({success: true});

            const [, graphQlRequest] = mockedFetch.mock.calls[0];
            expect(JSON.parse((graphQlRequest as any).body)).toEqual({
                "query": "mutation ($data: CampaignInput!) { addCampaign(data: $data) }",
                "variables": {
                    "data": {
                        "wallets": ["standard-wallet"],
                        "walletCampaignId": "test-wallet-campaign-id",
                        "name": "standard-wallet_test-wallet-campaign-id",
                        "type": "freeBets",
                        "config": {"bets": 10, "amount": 2, "currency": "eur"},
                        "games": ["internal-game"],
                        "nativeIds": ["test-native-player"],
                        "start": expect.any(Number),
                        "end": expect.any(Number),
                    },
                },
                "account": {},
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "add free bets to external rgs",
        async () => {
            const params = {
                walletCampaignId: "test-wallet-campaign-id",
                games: ["external-game"],
                nativeIds: ["test-native-player"],
                start: Date.now(),
                end: Date.now() + 24 * 60 * 60 * 1000,
                bets: 10,
                amount: 2,
                currency: "eur",
                operator: "my-operator",
                brand: "my-brand",
            };

            queueMockFetchAndParseResponse({success: true});

            const res = await request(api).post("/wallet/standard-wallet/freeBets/add").set(header(params, "secret-key")).send(params).expect(200);
            expect(res.body).toEqual({success: true});

            const [url, rgsResponse] = mockedFetchAndParse.mock.calls[0];
            expect(url).toEqual("https://external-rgs/freeBets/add");
            expect(JSON.parse((rgsResponse as any).body)).toEqual({
                "walletCampaignId": "test-wallet-campaign-id",
                "games": ["external-game"],
                "nativeIds": ["test-native-player"],
                "start": expect.any(Number),
                "end": expect.any(Number),
                "bets": 10,
                "amount": 2,
                "currency": "eur",
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "remove free bets from internal promo",
        async () => {
            const params = {
                walletCampaignId: "test-wallet-campaign-id",
                games: ["internal-game"],
                operator: "my-operator",
                brand: "my-brand",
            };

            const campaignId = v4();
            queueMockFetchResponse({data: {campaigns: {items: [campaignId]}}}, 200);
            queueMockFetchResponse({data: {deleteCampaign: campaignId}}, 200);

            const res = await request(api).post("/wallet/standard-wallet/freeBets/remove").set(header(params, "secret-key")).send(params).expect(200);
            expect(res.body).toEqual({success: true});

            const [, graphQlRequest] = mockedFetch.mock.calls[1];
            expect(JSON.parse((graphQlRequest as any).body)).toEqual({
                "query": "mutation ($campaignId: ID!, $data: CampaignInput!) { editCampaign(campaignId: $campaignId, data: $data) }",
                "variables": {
                    "data": {
                        "enabled": false,
                    },
                },
                "account": {},
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "remover free bets from external rgs",
        async () => {
            const params = {
                walletCampaignId: "test-wallet-campaign-id",
                games: ["external-game"],
                operator: "my-operator",
                brand: "my-brand",
            };

            queueMockFetchAndParseResponse({success: true});

            const res = await request(api).post("/wallet/standard-wallet/freeBets/remove").set(header(params, "secret-key")).send(params).expect(200);
            expect(res.body).toEqual({success: true});

            const [url, rgsResponse] = mockedFetchAndParse.mock.calls[0];
            expect(url).toEqual("https://external-rgs/freeBets/remove");
            expect(JSON.parse((rgsResponse as any).body)).toEqual({
                "walletCampaignId": "test-wallet-campaign-id",
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "available bets from internal promo",
        async () => {
            const params = {
                games: ["internal-game"],
                currencies: ["eur"],
                operator: "my-operator",
                brand: "my-brand",
            };

            queueMockFetchResponse({data: {availableBetsBulk: {bets: {"internal-game": {"eur": [0.1, 1, 10]}}}}}, 200);

            const res = await request(api).post("/wallet/standard-wallet/freeBets/availableBets").set(header(params, "secret-key")).send(params).expect(200);
            expect(res.body).toEqual({"internal-game": {"eur": [0.1, 1, 10]}});

            const [, graphQlRequest] = mockedFetch.mock.calls[0];
            expect(JSON.parse((graphQlRequest as any).body)).toEqual({
                "account": {},
                "query":
                    "query ($wallet: String!, $operator: String, $brand: String, $provider: String, $games: [String!]!, $jurisdiction: String, $currencies: [String!]) { availableBetsBulk(wallet: $wallet, operator: $operator, brand: $brand, provider: $provider, games: $games, jurisdiction: $jurisdiction, currencies: $currencies) { bets } }",
                "variables": {
                    "currencies": ["eur"],
                    "games": ["internal-game"],
                    "wallet": "standard-wallet",
                },
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "available bets from external promo",
        async () => {
            const params = {
                games: ["external-game"],
                currencies: ["eur"],
                operator: "my-operator",
                brand: "my-brand",
            };

            queueMockFetchAndParseResponse({"external-game": {"eur": [0.1, 1, 10]}});

            const res = await request(api).post("/wallet/standard-wallet/freeBets/availableBets").set(header(params, "secret-key")).send(params).expect(200);
            expect(res.body).toEqual({"external-game": {"eur": [0.1, 1, 10]}});

            const [url, rgsResponse] = mockedFetchAndParse.mock.calls[0];
            expect(url).toEqual("https://external-rgs/freeBets/availableBets");
            expect(JSON.parse((rgsResponse as any).body)).toEqual({
                "currencies": ["eur"],
                "games": ["external-game"],
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "add free bets games need to be from the same rgs",
        async () => {
            const params = {
                walletCampaignId: "test-wallet-campaign-id",
                games: ["internal-game", "external-game"],
                nativeIds: ["test-native-player"],
                bets: 10,
                amount: 2,
                currency: "eur",
                operator: "my-operator",
                brand: "my-brand",
            };

            const res = await request(api).post("/wallet/standard-wallet/freeBets/add").set(header(params, "secret-key")).send(params).expect(400);
            expect(res.body).toEqual({
                "error": {
                    "code": "APPLICATION_ERROR",
                    "message": "All games need to be from the same provider and rgs",
                },
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "remove free bets games need to be from the same rgs",
        async () => {
            const params = {
                walletCampaignId: "test-wallet-campaign-id",
                games: ["internal-game", "external-game"],
                operator: "my-operator",
                brand: "my-brand",
            };

            const res = await request(api).post("/wallet/standard-wallet/freeBets/remove").set(header(params, "secret-key")).send(params).expect(400);
            expect(res.body).toEqual({
                "error": {
                    "code": "APPLICATION_ERROR",
                    "message": "All games need to be from the same provider and rgs",
                },
            });
        },
        TEST_TIMEOUT,
    );

    test(
        "available bets games need to be from the same rgs",
        async () => {
            const params = {
                currencies: ["eur"],
                games: ["internal-game", "external-game"],
                operator: "my-operator",
                brand: "my-brand",
            };

            const res = await request(api).post("/wallet/standard-wallet/freeBets/availableBets").set(header(params, "secret-key")).send(params).expect(400);
            expect(res.body).toEqual({
                "error": {
                    "code": "APPLICATION_ERROR",
                    "message": "All games need to be from the same provider and rgs",
                },
            });
        },
        TEST_TIMEOUT,
    );
});
