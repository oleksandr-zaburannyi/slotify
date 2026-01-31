import {setEnvVariables} from "./setEnvVariables";
import {fetchAndParse} from "@slotify/shared/lib/fetch";

setEnvVariables();

import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Express} from "express";
import {createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {v4} from "uuid";
import {Campaign} from "../db/model/Campaign";
import {tools} from "../tools/tools";
import {testTool} from "./testTool";
import * as request from "supertest";
import auth from "@slotify/shared/lib/middleware/jwtAuth";
import Exception from "@slotify/shared/lib/Exception";
import {gql} from "graphql-request";
import {cleanupAfterTests} from "./cleanup";

jest.mock("@slotify/rng/lib/verify", () => ({
    verify: (jest.requireActual("@slotify/rng/lib/verify") as any).verify,
    setPeriodicVerification: jest.fn,
}));
jest.mock("@slotify/rng/lib/cycle", () => ({
    cycle: (jest.requireActual("@slotify/rng/lib/cycle") as any).cycle,
    setBackgroundCycling: jest.fn,
}));
jest.mock("@slotify/rng/lib/seed", () => ({
    seed: (jest.requireActual("@slotify/rng/lib/seed") as any).seed,
    setPeriodicReseeding: jest.fn,
}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetchAndParse = fetchAndParse as jest.MockedFunction<typeof fetchAndParse>;

jest.mock("../util/routes", () => {
    const original: any = jest.requireActual("../util/routes");
    return {...original, startCheckingCampaigns: jest.fn()};
});

let api: Express;
beforeAll(async () => {
    tools["test-tool"] = testTool;
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

afterEach(async () => {
    jest.clearAllMocks();
    const campaigns = await Campaign.find({});
    for (const {campaignId} of campaigns) {
        await Campaign.deleteCascade(campaignId);
    }
});

describe("freeBets", () => {
    test("normal flow", async () => {
        const type = "freeBets";
        const {campaignId} = await Campaign.createWithState({name: "test", type, config: {bets: 2, amount: 1, currency: "eur"}});
        const player = {
            provider: "my-provider",
            game: "my-game",
            playerId: v4(),
            wallet: "demo",
            operator: "my-operator",
            brand: "my-brand",
            nativeId: "my-native-id",
            currency: "sek",
        };
        const token = auth.sign(player, "player");

        mockedFetchAndParse.mockReturnValue(Promise.resolve({converted: 10}));
        await request(api).post("/api/authenticate").send(player).expect(200);
        const roundId1 = v4();

        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);

        const feed0 = await request(api)
            .get("/feed/player/" + campaignId + "?" + new URLSearchParams({game: "a", provider: "b", currency: "sek"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(feed0.body).toEqual({amount: 10, used: 0, total: 2, left: 2});

        //bet 1
        const transaction1 = {transactionId: v4(), amount: 10, roundId: roundId1, roundFinished: false, category: "normal"};
        const data1 = {...player, ...transaction1, type};
        const bet1 = await request(api).post("/api/transaction/withdraw").send(data1).expect(200);
        await request(api).post("/api/transaction/withdrawFinished").send(data1).expect(200);
        expect(bet1.body).toMatchObject({campaignId, campaignType: type});
        const res1 = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res1.body.playerState).toEqual({amount: 10, totalWin: 0, used: 1});
        const feed1 = await request(api)
            .get("/feed/player/" + campaignId + "?" + new URLSearchParams({game: "a", provider: "b", currency: "sek"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(feed1.body).toEqual({amount: 10, used: 1, total: 2, left: 1});

        //win 1
        const transaction2 = {transactionId: v4(), amount: 5, roundId: roundId1, roundFinished: true, category: "normal"};
        const data2 = {...player, ...transaction2, type};
        await request(api).post("/api/transaction/deposit").send(data2).expect(200);
        await request(api).post("/api/transaction/depositFinished").send(data2).expect(200);
        const res2 = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res2.body.playerState).toEqual({amount: 10, totalWin: 5, used: 1});
        const feed2 = await request(api)
            .get("/feed/player/" + campaignId + "?" + new URLSearchParams({game: "a", provider: "b", currency: "sek"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(feed2.body).toEqual({amount: 10, used: 1, total: 2, left: 1});

        const roundId2 = v4();
        //bet 2
        const transaction3 = {transactionId: v4(), amount: 10, roundId: roundId2, roundFinished: false, category: "normal"};
        const data3 = {...player, ...transaction3, type};
        const bet2 = await request(api).post("/api/transaction/withdraw").send(data3).expect(200);
        await request(api).post("/api/transaction/withdrawFinished").send(data3).expect(200);
        expect(bet2.body).toMatchObject({campaignId, campaignType: type});
        const res3 = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res3.body.playerState).toEqual({amount: 10, totalWin: 5, used: 2});
        const feed3 = await request(api)
            .get("/feed/player/" + campaignId + "?" + new URLSearchParams({game: "a", provider: "b", currency: "sek"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(feed3.body).toEqual({amount: 10, used: 2, total: 2, left: 0});

        //win 2
        const transaction4 = {transactionId: v4(), amount: 2, roundId: roundId2, roundFinished: true, category: "normal"};
        const data4 = {...player, ...transaction4, type};
        await request(api).post("/api/transaction/deposit").send(data4).expect(200);
        await request(api).post("/api/transaction/depositFinished").send(data4).expect(200);
        const res4 = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res4.body.playerState).toEqual({amount: 10, totalWin: 7, used: 2});
        const feed4 = await request(api)
            .get("/feed/player/" + campaignId + "?" + new URLSearchParams({game: "a", provider: "b", currency: "sek"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(feed4.body).toEqual({amount: 10, used: 2, total: 2, left: 0});
        expect(res4.body.status).toEqual("finished");
    });

    test("cancel", async () => {
        const type = "freeBets";
        const {campaignId} = await Campaign.createWithState({name: "test", type, config: {bets: 2, amount: 1, currency: "eur"}});
        const player = {
            provider: "my-provider",
            game: "my-game",
            playerId: v4(),
            wallet: "demo",
            operator: "my-operator",
            brand: "my-brand",
            nativeId: "my-native-id",
            currency: "sek",
        };
        const token = auth.sign(player, "player");

        mockedFetchAndParse.mockReturnValue(Promise.resolve({converted: 10}));
        await request(api).post("/api/authenticate").send(player).expect(200);
        const roundId = v4();

        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);

        const transaction = {transactionId: v4(), amount: 10, roundId: roundId, roundFinished: false, category: "normal"};
        const data = {...player, ...transaction, type};
        await request(api).post("/api/transaction/withdraw").send(data).expect(200);
        await request(api).post("/api/transaction/withdrawFinished").send(data).expect(200);
        const res1 = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res1.body.playerState.used).toEqual(1);
        await request(api).post("/api/transaction/cancel").send(data).expect(200);

        const res2 = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res2.body.playerState.used).toEqual(0);
    });

    test("withdrawFailed cleans up withdraw state", async () => {
        const type = "freeBets";
        const {campaignId} = await Campaign.createWithState({name: "test", type, config: {bets: 1, amount: 1, currency: "eur"}});
        const player = {
            provider: "my-provider",
            game: "my-game",
            playerId: v4(),
            wallet: "demo",
            operator: "my-operator",
            brand: "my-brand",
            nativeId: "my-native-id",
            currency: "sek",
        };
        const token = auth.sign(player, "player");

        mockedFetchAndParse.mockReturnValue(Promise.resolve({converted: 10}));
        await request(api).post("/api/authenticate").send(player).expect(200);
        const roundId = v4();

        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);

        const transaction = {transactionId: v4(), amount: 10, roundId: roundId, roundFinished: false, category: "normal"};
        const data = {...player, ...transaction, type};

        // Call withdraw - this sets _rounds[roundId] = "withdraw"
        await request(api).post("/api/transaction/withdraw").send(data).expect(200);

        // Call withdrawFailed - this should clean up the round tracking
        await request(api).post("/api/transaction/withdrawFailed").send(data).expect(200);

        // Verify used is still 0 since withdrawFinished was never called
        const res = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res.body.playerState.used).toEqual(0);

        // Verify the round can be played again (proves cleanup happened)
        const newTransaction = {transactionId: v4(), amount: 10, roundId: roundId, roundFinished: false, category: "normal"};
        const withdrawRes = await request(api)
            .post("/api/transaction/withdraw")
            .send({...player, ...newTransaction, type})
            .expect(200);
        expect(withdrawRes.body).toMatchObject({campaignId, campaignType: type});
    });

    test("visibility caching 1", async () => {
        const type = "freeBets";
        const {campaignId} = await Campaign.createWithState({name: "test", type, config: {bets: 2, amount: 1, currency: "eur"}});
        const player = {
            provider: "my-provider",
            game: "my-game",
            playerId: v4(),
            wallet: "demo",
            operator: "my-operator",
            brand: "my-brand",
            nativeId: "my-native-id",
            currency: "sek",
            jurisdiction: "mt",
        };
        const token = auth.sign(player, "player");

        mockedFetchAndParse.mockReturnValue(Promise.resolve({converted: 10}));
        await request(api).post("/api/authenticate").send(player).expect(200);

        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);

        mockedFetchAndParse.mockImplementation(() => {
            throw new Exception("");
        });
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body.campaigns).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    end: null,
                    name: "test",
                    status: "active",
                    type: "freeBets",
                }),
            ]),
        );
    });

    test("visibility caching 2", async () => {
        const type = "freeBets";
        await Campaign.createWithState({name: "test", type, config: {bets: 2, amount: 1, currency: "eur"}});
        const player = {
            provider: "my-provider",
            game: "my-game",
            playerId: v4(),
            wallet: "demo",
            operator: "my-operator",
            brand: "my-brand",
            nativeId: "my-native-id",
            currency: "sek",
            jurisdiction: "mt",
        };
        const token = auth.sign(player, "player");

        mockedFetchAndParse.mockImplementation(() => {
            throw new Exception("");
        });
        await request(api).post("/api/authenticate").send(player).expect(200);

        mockedFetchAndParse.mockReturnValue(Promise.resolve({converted: 10}));
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body.campaigns).toEqual([]);
    });

    test("create", async () => {
        const campaign = {name: "test", type: "freeBets", config: {bets: 2, amount: 1, currency: "eur"}, nativeIds: ["my-native-id"]};
        mockedFetchAndParse.mockImplementation(async url => {
            if ((url as string).includes("/games")) return {"my-provider": ["a", "b"]};
            return {converted: 10};
        });
        const query = gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `;

        const res = await graphQlRequest(api, "", query, {data: campaign}, {}).expect(200);
        expect(res.body.data.addCampaign).toEqual(expect.any(String));
    });

    test("create - wrong game or bet", async () => {
        const campaign = {name: "test", type: "freeBets", config: {bets: 2, amount: 1, currency: "eur"}, nativeIds: ["my-native-id"]};
        mockedFetchAndParse.mockImplementation(async url => {
            if ((url as string).includes("/games")) return {"my-provider": ["game1", "game2"]};
            throw new Exception("");
        });
        const query = gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `;

        const res = await graphQlRequest(api, "", query, {data: campaign}, {}).expect(200);
        expect(res.body.errors[0].message).toEqual("Bet 1 eur not supported on game game1 from provider my-provider");
    });

    test("free bets disabled during the round use inactive campaign", async () => {
        const type = "freeBets";
        const campaign = await Campaign.createWithState({name: "test", type, config: {bets: 2, amount: 1, currency: "eur"}});
        const campaignId = campaign.campaignId;

        const player = {
            provider: "my-provider",
            game: "my-game",
            playerId: v4(),
            wallet: "demo",
            operator: "my-operator",
            brand: "my-brand",
            nativeId: "my-native-id",
            currency: "sek",
        };
        const token = auth.sign(player, "player");

        mockedFetchAndParse.mockReturnValue(Promise.resolve({converted: 10}));
        await request(api).post("/api/authenticate").send(player).expect(200);
        const roundId1 = v4();

        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);

        //withdraw
        const withdrawTransaction = {transactionId: v4(), amount: 10, roundId: roundId1, roundFinished: false, category: "normal"};
        const promoWithdrawRequest = {...player, ...withdrawTransaction, type};
        const withdrawResponse = await request(api).post("/api/transaction/withdraw").send(promoWithdrawRequest).expect(200);
        expect(withdrawResponse.body).toEqual({
            callFinished: true,
            campaignData: {
                total: 2,
                used: 1,
                amount: 10,
                totalWin: 0,
            },
            campaignId,
            campaignType: "freeBets",
            campaigns: [campaignId],
            walletCampaignId: null,
        });

        await request(api).post("/api/transaction/withdrawFinished").send(promoWithdrawRequest).expect(200);

        await Campaign.updateWithState(campaignId, {...campaign, enabled: false});

        // force activeness on previous campaign even if player opts in to the new one
        const newActiveCampaign = await Campaign.createWithState({name: "new-active-campaign", type, config: {bets: 3, amount: 2, currency: "eur"}});
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post(`/campaigns/${newActiveCampaign.campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);

        //deposit
        const depositTransaction = {transactionId: v4(), amount: 5, roundId: roundId1, roundFinished: true, category: "normal"};
        const promoDepositRequest = {...player, ...depositTransaction, type};
        const depositResponse = await request(api).post("/api/transaction/deposit").send(promoDepositRequest).expect(200);

        expect(depositResponse.body).toEqual({
            callFinished: false,
            campaignData: {
                total: 2,
                used: 1,
                amount: 10,
                totalWin: 5,
            },
            campaignId,
            campaignType: "freeBets",
            campaigns: [campaignId],
            walletCampaignId: null,
        });
    }, 1000000);

    test("free bets deleted during the round repeat last campaignData", async () => {
        const type = "freeBets";
        const campaign = await Campaign.createWithState({name: "test", type, config: {bets: 2, amount: 1, currency: "eur"}});
        const campaignId = campaign.campaignId;

        const player = {
            provider: "my-provider",
            game: "my-game",
            playerId: v4(),
            wallet: "demo",
            operator: "my-operator",
            brand: "my-brand",
            nativeId: "my-native-id",
            currency: "sek",
        };
        const token = auth.sign(player, "player");

        mockedFetchAndParse.mockReturnValue(Promise.resolve({converted: 10}));
        await request(api).post("/api/authenticate").send(player).expect(200);
        const roundId1 = v4();

        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);

        //withdraw
        const withdrawTransaction = {transactionId: v4(), amount: 10, roundId: roundId1, roundFinished: false, category: "normal"};
        const promoWithdrawRequest = {...player, ...withdrawTransaction, type};
        const withdrawResponse = await request(api).post("/api/transaction/withdraw").send(promoWithdrawRequest).expect(200);
        expect(withdrawResponse.body).toEqual({
            callFinished: true,
            campaignData: {
                total: 2,
                used: 1,
                amount: 10,
                totalWin: 0,
            },
            campaignId,
            campaignType: "freeBets",
            campaigns: [campaignId],
            walletCampaignId: null,
        });

        await request(api).post("/api/transaction/withdrawFinished").send(promoWithdrawRequest).expect(200);

        await Campaign.deleteCascade(campaignId);

        //deposit
        const depositTransaction = {transactionId: v4(), amount: 5, roundId: roundId1, roundFinished: true, category: "normal"};
        const promoDepositRequest = {...player, ...depositTransaction, type};
        const depositResponse = await request(api).post("/api/transaction/deposit").send(promoDepositRequest).expect(200);

        expect(depositResponse.body).toEqual({
            callFinished: false,
            campaignData: {
                total: 2,
                used: 1,
                amount: 10,
                totalWin: 0,
            },
            campaignId,
            campaignType: "freeBets",
            campaigns: [campaignId],
            walletCampaignId: null,
        });
    });
});
