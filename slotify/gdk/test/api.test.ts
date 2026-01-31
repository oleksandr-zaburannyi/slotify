import {afterAll, beforeAll, describe, test} from "@jest/globals";
import request from "supertest";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {closeServer, initService} from "@slotify/shared/lib/testUtils";

jest.mock("@slotify/rng/lib/verify", () => ({verify: jest.requireActual("@slotify/rng/lib/verify").verify, setPeriodicVerification: jest.fn}));
jest.mock("@slotify/rng/lib/cycle", () => ({cycle: jest.requireActual("@slotify/rng/lib/cycle").cycle, setBackgroundCycling: jest.fn}));
jest.mock("@slotify/rng/lib/seed", () => ({seed: jest.requireActual("@slotify/rng/lib/seed").seed, setPeriodicReseeding: jest.fn}));

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    api = await initService();
});

afterAll(async () => {
    await closeServer();
});

describe("api", () => {
    test("games", async () => {
        const {body} = await request(api).get("/api/games").expect(200);
        expect(body).toEqual({myProvider: ["testmultigame1", "testmultigame2", "testgame"]});
    });

    test("cheats", async () => {
        const {body} = await request(api).get("/api/games/testgame/cheats").expect(200);
        expect(body).toEqual({main: ["win", "impossible"]});
    });

    test("config", async () => {
        const {body} = await request(api).get("/api/games/testgame/config?variant=testvariant").expect(200);
        expect(body).toEqual({testConfig: true, variant: "testvariant"});
    });

    test("default variant config", async () => {
        const {body: body1} = await request(api).get("/api/games/testmultigame1/config?variant=customVariant").expect(200);
        expect(body1).toEqual({variant: "customVariant"});
        const {body: body2} = await request(api).get("/api/games/testmultigame1/config").expect(200);
        expect(body2).toEqual({variant: "defaultVariant"});
        const {body: body3} = await request(api).get("/api/games/testmultigame1/config?variant=").expect(200);
        expect(body3).toEqual({variant: "defaultVariant"});
    });

    test("bets", async () => {
        const {body} = await request(api).get("/api/games/testgame/bets").expect(200);
        expect(body).toEqual({bets: {main: {available: [0.2, 1, 5], default: 1, maxWin: 100, coin: 10}}});
    });

    test("default variant bets", async () => {
        const {body: body1} = await request(api).get("/api/games/testmultigame1/bets?variant=customVariant").expect(200);
        expect(Object.keys(body1.bets)).toContain("customVariantAction");
        const {body: body2} = await request(api).get("/api/games/testmultigame1/bets").expect(200);
        expect(Object.keys(body2.bets)).toContain("main");
        const {body: body3} = await request(api).get("/api/games/testmultigame1/bets?variant=").expect(200);
        expect(Object.keys(body3.bets)).toContain("main");
    });

    test("validate true", async () => {
        const {body} = await request(api)
            .post("/api/games/testgame/validate")
            .send({action: "main", bet: 100, coin: 1, betLimits: {minBet: 50}})
            .expect(200);
        expect(body).toEqual({valid: true});
    });

    test("validate false", async () => {
        const {body} = await request(api)
            .post("/api/games/testgame/validate")
            .send({action: "main", bet: 100, coin: 1, betLimits: {minBet: 200}})
            .expect(200);
        expect(body).toEqual({valid: false});
    });

    test("play", async () => {
        const {body} = await request(api)
            .post("/api/games/testgame/play")
            .send({variant: "testvariant", bet: 1, action: "main", state: {testState: true}, coin: 10})
            .expect(200);
        expect(body).toEqual({data: {coin: 10, variant: "testvariant"}, win: expect.any(Number), next: ["bonus"], state: {_myPrivateState: 456, testState: 123}});
    });

    test("play with cheat - development environment", async () => {
        const isProduction = process.env.IS_PRODUCTION;
        process.env.IS_PRODUCTION = "false";
        const {body} = await request(api)
            .post("/api/games/testgame/play")
            .send({cheat: "win", variant: "testvariant", bet: 1, action: "main", state: {testState: true}, coin: 10})
            .expect(200);
        expect(body).toEqual({data: {coin: 10, variant: "testvariant"}, win: 2, next: ["bonus"], state: {_myPrivateState: 456, testState: 123}});
        process.env.IS_PRODUCTION = isProduction;
    });

    test("play with cheat - production environment", async () => {
        const isProduction = process.env.IS_PRODUCTION;
        process.env.IS_PRODUCTION = "true";
        const {body} = await request(api)
            .post("/api/games/testgame/play")
            .send({cheat: "impossible", variant: "testvariant", bet: 1, action: "main", state: {testState: true}, coin: 10})
            .expect(200);
        expect(body).toEqual({data: {coin: 10, variant: "testvariant"}, win: expect.any(Number), next: ["bonus"], state: {_myPrivateState: 456, testState: 123}});
        process.env.IS_PRODUCTION = isProduction;
    });

    test("action", async () => {
        const wager = {variant: "abc", coin: 100, bet: 5, next: ["bonus"]};
        const {body} = await request(api).post("/api/games/testgame/action").send(wager).expect(200);
        expect(body).toEqual({action: "bonus"});
    });

    test("multigame routing", async () => {
        const {body: body1} = await request(api).post("/api/games/testmultigame1/play").send({action: "main", bet: 13, coin: 1}).expect(200);

        const {body: body2} = await request(api).post("/api/games/testmultigame2/play").send({action: "main", bet: 13, coin: 1}).expect(200);
        expect(body1).toEqual(body2);
    });
});
