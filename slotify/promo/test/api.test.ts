import {setEnvVariables} from "./setEnvVariables";
import {fetchAndParse} from "@slotify/shared/lib/fetch";

setEnvVariables();

import {afterAll, afterEach, beforeAll, describe, jest, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {v4} from "uuid";
import {tools} from "../tools/tools";
import {testTool} from "./testTool";
import {Campaign} from "../db/model/Campaign";
import auth from "@slotify/shared/lib/middleware/jwtAuth";
import {PlayerState} from "../db/model/PlayerState";
import {IPrize, ITool} from "../util/ITool";
import {IPlayer} from "../util/routes";
import {CampaignLog} from "../db/model/CampaignLog";
import {CampaignState} from "../db/model/CampaignState";
import {CampaignPrize} from "../db/model/CampaignPrize";
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

let api: Express;
beforeAll(async () => {
    tools["test-tool"] = testTool;
    tools["not-visible-tool"] = {
        async visible() {
            return false;
        },
    };
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

type IToolReturned = {campaignState?: any; playerState?: any; logs?: {name: string; data: any}[]; finished?: boolean; prizes?: IPrize[]};

async function expectToolReturned(campaignId: string, playerId: string | null, {playerState, campaignState, logs, finished, prizes}: IToolReturned) {
    if (campaignState) {
        expect((await CampaignState.findOneBy({campaignId}))?.state).toEqual(campaignState);
    }
    if (playerState && playerId) {
        expect((await PlayerState.findOneBy({campaignId, playerId}))?.state).toEqual(playerState);
    }
    if (logs) {
        expect(await CampaignLog.find({where: {campaignId}, order: {id: "DESC"}})).toEqual(logs.map(log => ({...log, campaignId, createdAt: expect.any(Date), id: expect.any(Number)})));
    }
    if (finished && playerId) {
        expect((await PlayerState.findOneBy({campaignId, playerId}))?.finished).toEqual(finished);
    }
    if (prizes) {
        expect(await CampaignPrize.findBy({campaignId})).toEqual(prizes.map(prize => ({campaignId, ...prize, createdAt: expect.any(Date), id: expect.any(Number), paid: expect.any(Boolean), comment: null})));
    }
}

describe("api", () => {
    test("authenticate", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "init");
        jest.spyOn(testTool, "opt");
        const {body} = await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post("/api/authenticate").send(player).expect(200);
        expect(body).toEqual({auth: true});
        expect(testTool.init).toHaveBeenCalledWith(
            expect.objectContaining({
                config,
                player,
                loadCampaignState: expect.any(Function),
            }),
        );
        expect(testTool.init).toHaveBeenCalledTimes(1);
        expect(testTool.opt).not.toHaveBeenCalled();
        await expectToolReturned(campaignId, player.playerId, {playerState: {ps: "init"}, logs: [{name: "init", data: {log: "init"}}]});
    });

    test("authenticate with opt in", async () => {
        const config = {a: 123};
        testTool.autoOptIn = true;
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "init");
        jest.spyOn(testTool, "opt");
        const {body} = await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post("/api/authenticate").send(player).expect(200);
        expect(body).toEqual({auth: true});
        expect(testTool.init).toHaveBeenCalledWith(
            expect.objectContaining({
                config,
                player,
                loadCampaignState: expect.any(Function),
            }),
        );
        expect(testTool.init).toHaveBeenCalledTimes(1);
        expect(testTool.opt).toHaveBeenCalledWith({config, player, optIn: true, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.opt).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "opt", _ps: "opt"},
            campaignState: {cs: "opt", _cs: "opt"},
            logs: [
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });

        testTool.autoOptIn = undefined;
    });

    test("campaign", async () => {
        const config = {a: 123, _private: 456};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "init");
        jest.spyOn(testTool, "opt");
        const {body} = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({campaignId, config: {a: 123}, start: null, end: null, status: "started", type: "test-tool", name: "test-campaign", playerState: {ps: "init"}, campaignState: {}});
        expect(testTool.init).toHaveBeenCalledWith(
            expect.objectContaining({
                config,
                player,
                loadCampaignState: expect.any(Function),
            }),
        );
        expect(testTool.init).toHaveBeenCalledTimes(1);
        expect(testTool.opt).not.toHaveBeenCalled();
        await expectToolReturned(campaignId, player.playerId, {playerState: {ps: "init"}, logs: [{name: "init", data: {log: "init"}}]});
    });

    test("campaign with opt in", async () => {
        const config = {a: 123};
        testTool.autoOptIn = true;
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "init");
        jest.spyOn(testTool, "opt");
        const {body} = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({campaignId, config: {a: 123}, start: null, end: null, status: "active", type: "test-tool", name: "test-campaign", playerState: {ps: "opt"}, campaignState: {cs: "opt"}});
        expect(testTool.init).toHaveBeenCalledWith(
            expect.objectContaining({
                config,
                player,
                loadCampaignState: expect.any(Function),
            }),
        );
        expect(testTool.init).toHaveBeenCalledTimes(1);
        expect(testTool.opt).toHaveBeenCalledWith({config, player, optIn: true, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.opt).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "opt", _ps: "opt"},
            campaignState: {cs: "opt", _cs: "opt"},
            logs: [
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });
        testTool.autoOptIn = undefined;
    });

    test("opt in", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "opt");
        await request(api).post("/api/authenticate").send(player).expect(200);
        const {body} = await request(api)
            .post("/campaigns/" + campaignId + "/opt")
            .send({optIn: true, provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({optIn: true});
        expect(testTool.opt).toHaveBeenCalledWith({config, player, optIn: true, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.opt).toHaveBeenCalledTimes(1);

        const res = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res.body.status).toEqual("active");
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "opt", _ps: "opt"},
            campaignState: {cs: "opt", _cs: "opt"},
            logs: [
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });
    });

    test("opt out", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "opt");
        await request(api).post("/api/authenticate").send(player).expect(200);
        const {body} = await request(api)
            .post("/campaigns/" + campaignId + "/opt")
            .send({optIn: false, provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({optIn: false});
        expect(testTool.opt).toHaveBeenCalledWith({config, player, optIn: false, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.opt).toHaveBeenCalledTimes(1);

        const res = await request(api)
            .get("/campaigns/" + campaignId + "?" + new URLSearchParams({provider: "my-provider", game: "my-game"}).toString())
            .auth(token, {type: "bearer"})
            .expect(400);
        expect(res.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "opt", _ps: "opt"},
            campaignState: {cs: "opt", _cs: "opt"},
            logs: [
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });
    });

    test("acknowledge - player finished", async () => {
        const config = {a: 123};
        testTool.autoOptIn = true;
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "acknowledge");
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api)
            .post("/campaigns/" + campaignId + "/acknowledge")
            .send({provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(400);
        await PlayerState.update({campaignId}, {finished: true});
        const {body} = await request(api)
            .post("/campaigns/" + campaignId + "/acknowledge")
            .send({provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({acknowledge: true});
        expect(testTool.acknowledge).toHaveBeenCalledWith({config, player, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.acknowledge).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "acknowledge"},
            campaignState: {cs: "acknowledge"},
            logs: [
                {name: "acknowledge", data: {log: "acknowledge"}},
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });
        testTool.autoOptIn = undefined;
    });

    test("acknowledge - campaign ended", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "acknowledge");
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);
        await request(api)
            .post("/campaigns/" + campaignId + "/acknowledge")
            .send({provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(400);
        await Campaign.update({campaignId}, {end: new Date()});
        const {body} = await request(api)
            .post("/campaigns/" + campaignId + "/acknowledge")
            .send({provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({acknowledge: true});
        expect(testTool.acknowledge).toHaveBeenCalledWith({config, player, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.acknowledge).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "acknowledge"},
            campaignState: {cs: "acknowledge"},
            logs: [
                {name: "acknowledge", data: {log: "acknowledge"}},
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });
    });

    test("player event", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "playerEvent");
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);
        const res1 = await request(api)
            .post("/event/player/" + campaignId)
            .send({provider: "my-provider", game: "my-game", eventName: "my-event", eventId: "event-id", params: {myParams: 123}})
            .auth(token, {type: "bearer"})
            .expect(200);
        const res2 = await request(api)
            .post("/event/player/" + campaignId)
            .send({provider: "my-provider", game: "my-game", eventName: "my-event", eventId: "event-id", params: {myParams: 123}})
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(res1.body).toEqual({myResponse: 123});
        expect(res2.body).toEqual({myResponse: 123});
        expect(testTool.playerEvent).toHaveBeenCalledWith({eventName: "my-event", params: {myParams: 123}, config, player, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.playerEvent).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "playerEvent"},
            campaignState: {cs: "playerEvent"},
            finished: true,
            logs: [
                {name: "playerEvent", data: {log: "playerEvent"}},
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        });
    });

    test("campaign feed", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "campaignFeed");
        await request(api).post("/api/authenticate").send(player).expect(200);
        const {body} = await request(api)
            .get("/feed/campaign/" + campaignId + "?someData=a")
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({someData: "a", otherData: 2});
        expect(testTool.campaignFeed).toHaveBeenCalledWith({start: null, end: null, params: {someData: "a"}, config, loadCampaignState: expect.any(Function)});
        expect(testTool.campaignFeed).toHaveBeenCalledTimes(1);
    });

    test("player feed - authenticated", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "playerFeed");
        await request(api).post("/api/authenticate").send(player).expect(200);
        const {body} = await request(api)
            .get("/feed/player/" + campaignId + "?someData=a")
            .auth(token, {type: "bearer"})
            .expect(200);
        expect(body).toEqual({someData: "a", otherData: 2});
        expect(testTool.playerFeed).toHaveBeenCalledWith({start: null, end: null, params: {someData: "a"}, config, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.playerFeed).toHaveBeenCalledTimes(1);
    });

    test("player feed - playerId", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "playerFeed");
        await request(api).post("/api/authenticate").send(player).expect(200);
        const {body} = await request(api)
            .get("/feed/player/" + campaignId + "/" + player.playerId + "?someData=a")
            .expect(200);
        expect(body).toEqual({someData: "a", otherData: 2});
        expect(testTool.playerFeed).toHaveBeenCalledWith({start: null, end: null, params: {someData: "a"}, config, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.playerFeed).toHaveBeenCalledTimes(1);
    });

    test("player feed - wallet & nativeId", async () => {
        const config = {a: 123};
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        mockedFetchAndParse.mockReturnValue(Promise.resolve({id: player.playerId}));
        jest.spyOn(testTool, "playerFeed");
        await request(api).post("/api/authenticate").send(player).expect(200);
        const {body} = await request(api)
            .get("/feed/player/" + campaignId + "/" + player.wallet + "/" + player.nativeId + "?someData=a")
            .expect(200);
        expect(body).toEqual({someData: "a", otherData: 2});
        expect(testTool.playerFeed).toHaveBeenCalledWith({start: null, end: null, params: {someData: "a"}, config, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function)});
        expect(testTool.playerFeed).toHaveBeenCalledTimes(1);
    });

    test.each(["withdraw", "withdrawFinished", "deposit", "depositFinished"])("transaction - %s", async mode => {
        const config = {a: 123};
        const type: string = mode.replace("Finished", "");
        const roundId = v4();
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, mode as any);
        const token = auth.sign(player, "player");
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);
        const transaction = {transactionId: v4(), amount: 10, roundId, roundFinished: type === "deposit", game: "my-game", category: "normal"};
        const data = {...player, ...transaction, type};
        const res1 = await request(api)
            .post("/api/transaction/" + mode)
            .send(data)
            .expect(200);
        const res2 = await request(api)
            .post("/api/transaction/" + mode)
            .send(data)
            .expect(200);
        let body = {};
        if (mode === "withdraw") body = {callFinished: true, jackpotAmount: 100, campaignType: "test-tool", campaignId, campaigns: [campaignId], walletCampaignId: null};
        if (mode === "withdrawFinished") body = {callFinished: false, data: {"test-tool": {d: "withdrawFinished"}}, campaigns: [campaignId]};
        if (mode === "deposit") body = {callFinished: true, jackpotAmount: 100, campaignType: "test-tool", campaignId, campaigns: [campaignId], walletCampaignId: null};
        if (mode === "depositFinished") body = {callFinished: false, data: {"test-tool": {d: "depositFinished"}}, campaigns: [campaignId]};

        expect(res1.body).toEqual(body);
        expect(res1.body).toEqual(res2.body);
        expect(testTool[mode as keyof ITool]).toHaveBeenCalledWith({config, player, transaction, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function), start: null, end: null});
        expect(testTool[mode as keyof ITool]).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: mode},
            campaignState: {cs: mode},
            logs: [
                {name: mode, data: {log: mode}},
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        });
    });

    test("cancel withdrawFinished", async () => {
        const config = {a: 123};
        const roundId = v4();
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "cancel");
        const token = auth.sign(player, "player");
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);
        const transaction = {transactionId: v4(), amount: 10, roundId, roundFinished: false, game: "my-game", category: "normal"};
        const data = {...player, ...transaction, type: "withdraw"};
        await request(api).post("/api/transaction/withdraw").send(data).expect(200);
        await request(api).post("/api/transaction/withdrawFinished").send(data).expect(200);

        await PlayerState.update({campaignId, playerId: player.playerId}, {finished: false});
        const res1 = await request(api).post("/api/transaction/cancel").send(data).expect(200);
        const res2 = await request(api).post("/api/transaction/cancel").send(data).expect(200);
        const body = {callFinished: false, campaigns: [campaignId]};

        expect(res1.body).toEqual(body);
        expect(res1.body).toEqual(res2.body);
        expect(testTool.cancel).toHaveBeenCalledWith({config, player, transaction, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function), start: null, end: null});
        expect(testTool.cancel).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "cancel"},
            campaignState: {cs: "cancel"},
            finished: false,
            logs: [
                {name: "cancel", data: {log: "cancel"}},
                {name: "withdrawFinished", data: {log: "withdrawFinished"}},
                {name: "withdraw", data: {log: "withdraw"}},
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });
    });

    test("cancel withdraw", async () => {
        const config = {a: 123};
        const roundId = v4();
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "cancel");
        const token = auth.sign(player, "player");
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);
        const transaction = {transactionId: v4(), amount: 10, roundId, roundFinished: false, game: "my-game", category: "normal"};
        const data = {...player, ...transaction, type: "withdraw"};
        await request(api).post("/api/transaction/withdraw").send(data).expect(200);

        await PlayerState.update({campaignId, playerId: player.playerId}, {finished: false});
        const res1 = await request(api).post("/api/transaction/cancel").send(data).expect(200);

        const body = {callFinished: false, campaigns: [campaignId]};

        expect(res1.body).toEqual(body);
        expect(testTool.cancel).toHaveBeenCalledWith({config, player, transaction, loadCampaignState: expect.any(Function), loadPlayerState: expect.any(Function), start: null, end: null});
        expect(testTool.cancel).toHaveBeenCalledTimes(1);
        await expectToolReturned(campaignId, player.playerId, {
            playerState: {ps: "cancel"},
            campaignState: {cs: "cancel"},
            finished: false,
            logs: [
                {name: "cancel", data: {log: "cancel"}},
                {name: "withdraw", data: {log: "withdraw"}},
                {name: "opt", data: {log: "opt"}},
                {name: "init", data: {log: "init"}},
            ],
        });
    });

    test("cancel with no corresponding withdraw", async () => {
        const config = {a: 123};
        const roundId = v4();
        const {campaignId} = await Campaign.createWithState({type: "test-tool", name: "test-campaign", config});
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
        jest.spyOn(testTool, "cancel");
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api).post(`/campaigns/${campaignId}/opt/`).send({optIn: true, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"}).expect(200);
        const transaction = {transactionId: v4(), amount: 10, roundId, roundFinished: false, game: "my-game", category: "normal"};
        const data = {...player, ...transaction, type: "cancel"};
        const res1 = await request(api).post("/api/transaction/cancel").send(data).expect(200);
        const res2 = await request(api).post("/api/transaction/cancel").send(data).expect(200);
        const body = {callFinished: false, campaigns: [campaignId]};

        expect(res1.body).toEqual(body);
        expect(res1.body).toEqual(res2.body);
        expect(testTool.cancel).not.toHaveBeenCalled();
    });

    test("campaigns - empty", async () => {
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
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: []});
    });

    test("campaigns - not visible", async () => {
        await Campaign.createWithState({name: "test", type: "not-visible-tool", config: {a: 1}});
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
        const visibleSpy = jest.spyOn(tools["not-visible-tool"], "visible");

        visibleSpy.mockClear();
        const token = auth.sign(player, "player");
        await request(api).post("/api/authenticate").send(player).expect(200);
        expect(tools["not-visible-tool"].visible).toHaveBeenCalledWith(
            expect.objectContaining({
                config: {a: 1},
                player,
                loadCampaignState: expect.any(Function),
                loadPlayerState: expect.any(Function),
            }),
        );

        // check cache
        visibleSpy.mockClear();
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(tools["not-visible-tool"].visible).toHaveBeenCalledTimes(0);
        expect(res.body).toEqual({campaigns: []});
    });

    test("campaigns - started", async () => {
        const campaign = await Campaign.createWithState({name: "test", type: "test-tool", config: {a: 1}});
        const {campaignId, end, name, start, type} = campaign;
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
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: [{campaignId, end, name, start, type, status: "started"}]});
    });

    test("campaigns - active (after optIn)", async () => {
        const campaign = await Campaign.createWithState({name: "test", type: "test-tool", config: {a: 1}});
        const {campaignId, end, name, start, type} = campaign;
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
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api)
            .post("/campaigns/" + campaignId + "/opt")
            .send({optIn: true, provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: [{campaignId, end, name, start, type, status: "active"}]});
    });

    test("campaigns - empty (after optOut)", async () => {
        const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool", config: {a: 1}});
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
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api)
            .post("/campaigns/" + campaignId + "/opt")
            .send({optIn: false, provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: []});
    });

    test("campaigns - planned", async () => {
        const start = new Date();
        start.setHours(start.getHours() + 1);
        const campaign = await Campaign.createWithState({name: "test", start, type: "test-tool", config: {a: 1}});
        const {campaignId, end, name, type} = campaign;

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
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: [{campaignId, end, name, start: start.toISOString(), type, status: "planned"}]});
    });

    test("campaigns - finished (without participation)", async () => {
        const end = new Date();
        end.setHours(end.getHours() - 1);
        await Campaign.createWithState({name: "test", end, type: "test-tool", config: {a: 1}});

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
        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: []});
    });

    test("campaigns - finished (end date)", async () => {
        const campaign = await Campaign.createWithState({name: "test", type: "test-tool", config: {a: 1}});
        const {campaignId, start, name, type} = campaign;

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
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api)
            .post("/campaigns/" + campaign.campaignId + "/opt")
            .send({optIn: true, provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);

        const end = new Date();
        end.setHours(end.getHours() - 1);
        await Campaign.update({campaignId}, {end});

        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: [{campaignId, start, name, end: end.toISOString(), type, status: "finished"}]});
    });

    test("campaigns - finished (player finish)", async () => {
        const campaign = await Campaign.createWithState({name: "test", type: "test-tool", config: {a: 1}});
        const {campaignId, start, end, name, type} = campaign;

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
        await request(api).post("/api/authenticate").send(player).expect(200);
        await request(api)
            .post("/campaigns/" + campaign.campaignId + "/opt")
            .send({optIn: true, provider: "my-provider", game: "my-game"})
            .auth(token, {type: "bearer"})
            .expect(200);

        await PlayerState.update({campaignId, playerId: player.playerId}, {finished: true});

        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: [{campaignId, start, name, end, type, status: "finished"}]});
    });

    test("campaigns - disabled", async () => {
        await Campaign.createWithState({name: "test", enabled: false, type: "test-tool", config: {a: 1}});

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

        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: []});
    });

    test("campaigns - two campaigns of the same type", async () => {
        const campaign = await Campaign.createWithState({name: "test", type: "test-tool", config: {a: 1}});
        const {campaignId, start, end, name, type} = campaign;
        await Campaign.createWithState({name: "test2", type: "test-tool", config: {a: 1}});

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

        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: [{campaignId, name, start, end, type, status: "started"}]});
    });

    test("campaigns - start time priority", async () => {
        const campaignStart = new Date();
        campaignStart.setHours(campaignStart.getHours() + 1);

        await Campaign.createWithState({name: "test0", type: "test-tool", config: {a: 1}, start: campaignStart});
        const visibleCampaign = await Campaign.createWithState({name: "test1", type: "test-tool", config: {a: 1}});
        const {campaignId, start, end, name, type} = visibleCampaign;

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

        const res = await request(api).get("/campaigns?game=my-game&provider=my-provider").auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: [{campaignId, name, start, end, type, status: "started"}]});
    });

    test.each<[string, Partial<Campaign>, Partial<IPlayer>, boolean]>([
        ["nativeId included", {nativeIds: ["some-nativeId"]}, {nativeId: "some-nativeId"}, true],
        ["nativeId excluded", {nativeIds: ["some-nativeId"]}, {nativeId: "some-nativeId2"}, false],
        ["playerId included", {nativeIds: ["some-playerId"]}, {nativeId: "some-playerId"}, true],
        ["playerId excluded", {playerIds: ["some-playerId"]}, {playerId: "some-playerId2"}, false],
        ["wallet included", {wallets: ["some-wallet"]}, {wallet: "some-wallet"}, true],
        ["wallet excluded", {wallets: ["some-wallet"]}, {wallet: "some-wallet2"}, false],
        ["operator included", {operators: ["some-operator"]}, {operator: "some-operator"}, true],
        ["operator excluded", {operators: ["some-operator"]}, {operator: "some-operator2"}, false],
        ["brand included", {brands: ["some-brand"]}, {brand: "some-brand"}, true],
        ["brand excluded", {brands: ["some-brand"]}, {brand: "some-brand2"}, false],
        ["provider included", {providers: ["some-provider"]}, {provider: "some-provider"}, true],
        ["provider excluded", {providers: ["some-provider"]}, {provider: "some-provider2"}, false],
        ["game included", {games: ["some-game"]}, {game: "some-game"}, true],
        ["game excluded", {games: ["some-game"]}, {game: "some-game2"}, false],
        ["mixed included", {nativeIds: ["native-id1", "native-id2"], wallets: ["some-wallet"]}, {nativeId: "native-id2", wallet: "some-wallet"}, true],
        ["mixed excluded 1", {nativeIds: ["native-id1", "native-id2"], wallets: ["some-wallet"]}, {nativeId: "native-id2", wallet: "some-wallet1"}, false],
        ["mixed excluded 2", {nativeIds: ["native-id1", "native-id2"], wallets: ["some-wallet"]}, {nativeId: "native-id3", wallet: "some-wallet"}, false],
    ])("campaigns - filter %s", async (_, campaignFields, playerFields, included) => {
        const campaign = await Campaign.createWithState({name: "test", type: "test-tool", config: {a: 1}, ...campaignFields});
        const {campaignId, start, end, name, type} = campaign;

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
            ...playerFields,
        };
        const token = auth.sign(player, "player");
        const game = playerFields.game ? playerFields.game : "my-game";
        const provider = playerFields.provider ? playerFields.provider : "my-provider";
        const res = await request(api).get(`/campaigns?game=${game}&provider=${provider}`).auth(token, {type: "bearer"}).expect(200);
        expect(res.body).toEqual({campaigns: included ? [{campaignId, name, start, end, type, status: "started"}] : []});
    });
});
