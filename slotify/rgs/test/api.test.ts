import {setEnvVariables} from "./setEnvVariables";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import * as request from "supertest";
import {v4} from "uuid";
import {Express} from "express";
import {closeDatabase, closeServer, createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {Settings} from "../db/model/Settings";
import {Currency} from "../db/model/Currency";
import {Round} from "../db/model/Round";
import {Wager} from "../db/model/Wager";
import Exception from "@slotify/shared/lib/Exception";
import {RoundArchive} from "../db/model/RoundArchive";
import {WagerArchive} from "../db/model/WagerArchive";
import {closeRedis} from "@slotify/shared/lib/redis";
import {stopScheduler} from "@slotify/shared/lib/scheduler";
import {invalidate} from "@slotify/shared/lib/cache";
import wait from "@slotify/shared/lib/wait";
import {stopIntervals} from "../util/metrics";

setEnvVariables();

jest.mock("@slotify/shared/lib/sendAlert", () => ({sendAlert: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");
jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));

let api: Express;
beforeAll(async () => {
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await Settings.clear();
    await Currency.clear();
});

afterAll(async () => {
    await closeServer();
    await closeDatabase();
    await closeRedis();
    stopScheduler();
    stopIntervals();
});

const mockedFetch = fetchAndParse as jest.MockedFunction<typeof fetchAndParse>;

const mockResponse = (response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(response));
};

afterEach(() => {
    setEnvVariables();
    mockedFetch.mockReset();
});

beforeAll(async () => {
    await Currency.create({currency: "sek", fixedRate: 10}).save();
    await Currency.create({currency: "ubtc", fixedRate: 7}).save();
});

const authenticate = async (currency = "sek") => {
    const data = {wallet: "test-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
    mockResponse({balance: 100, currency, nativeId: "native-id", playerId: v4(), brand: "test-brand", jurisdiction: "mt"});
    const {body} = await request(api).post("/authenticate").send(data).expect(200);
    return body;
};

const play = async (token: string, action = "main", bet?: number, next?: string[], roundId?: string, stateFn?: (prevState?: any) => any, cheat?: string, game = "test-game", valid: boolean = true, rngPayload: any = null) => {
    const data = {provider: "test-provider", game, bet, action, roundId, cheat};
    mockedFetch.mockImplementation(async (url, data) => {
        if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1, coin: 2}, main2: {available: [500], maxWin: 5, minBet: 5, coin: 50, validate: true}}});
        if ((url as string).indexOf("/transaction") >= 0) return Promise.resolve({balance: 123});
        if ((url as string).indexOf("/play") >= 0) {
            return Promise.resolve({
                win: 100,
                data: {test: true},
                next,
                state: stateFn ? stateFn(JSON.parse(data?.body as any).state) : {s: 1, _s: 2},
                rngPayload,
            });
        }
        if ((url as string).indexOf("/validate") >= 0) return Promise.resolve({valid});
        if ((url as string).indexOf("/cancel") >= 0) return Promise.resolve({balance: 123});
        if ((url as string).indexOf("/api/games") >= 0) return Promise.resolve({"test-provider": ["test-game", "game2", "test-game-disabled", "test-game2"]});
        if ((url as string).indexOf("/api/sessions") >= 0) return Promise.resolve({});
        if ((url as string).indexOf("/api/fairness/getRoundRngState") >= 0)
            return Promise.resolve({
                clientSeed: "client-seed",
                serverSeed: "server-seed",
                nonce: 13,
                cursor: 10,
            });
        if ((url as string).indexOf("/api/fairness/updateRoundRngCursor") >= 0) return Promise.resolve({success: true});
        if ((url as string).indexOf("/api/currencies") >= 0)
            return Promise.resolve({
                currencies: [
                    {currency: "eur", rate: 1},
                    {currency: "sek", rate: 11.07},
                ],
            });
    });

    const {body} = await request(api).post("/game/play").send(data).auth(token, {type: "bearer"});
    return body;
};

const complete = async (token: string, roundId: string) => {
    const data = {roundId, game: "test-game", provider: "test-provider"};
    mockedFetch.mockImplementation(async url => {
        if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1, coin: 2}, main2: {available: [500], maxWin: 5, minBet: 5, coin: 50}}});
        if ((url as string).indexOf("/transaction") >= 0) return Promise.resolve({balance: 123.45});
    });

    const {body} = await request(api).post("/game/complete").send(data).auth(token, {type: "bearer"});
    return body;
};

async function forceUnpaidRound() {
    const {token} = await authenticate();
    const {roundId} = await play(token, "main", 100);
    mockedFetch.mockImplementationOnce(async url => {
        if ((url as string).indexOf("/transaction") >= 0) throw new Exception("Force round status unpaid");
    });
    await request(api).post("/game/complete").send({roundId, game: "test-game", provider: "test-provider"}).auth(token, {type: "bearer"});
    return token;
}

describe("api", () => {
    test("authenticate", async () => {
        const data = {wallet: "test-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        mockResponse({balance: 100, currency: "sek", nativeId: "native-id", playerId: v4(), brand: "test-brand", jurisdiction: "mt"});
        const {body} = await request(api).post("/authenticate").send(data).expect(200);
        expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({...data, ip: expect.any(String)});
        expect(body).toEqual({balance: 100, token: expect.any(String), currency: "sek", jurisdiction: "mt", currencyDecimals: 2, currencySymbol: "sek", playerId: expect.any(String)});
    });

    test("play and complete", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main", 100);
        expect(body).toEqual({balance: 123, roundId: expect.any(String), wager: {state: {s: 1}, win: 100, data: {test: true}}});
        const body2 = await complete(token, body.roundId);
        expect(body2).toEqual({balance: 123.45, finalWin: 100});
    });

    test("play and complete - multistep", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        const body = await play(token, "second", undefined, undefined, roundId);
        expect(body).toEqual({balance: undefined, roundId: expect.any(String), wager: {state: {s: 1}, win: 100, data: {test: true}}});
        const body2 = await complete(token, roundId);
        expect(body2).toEqual({balance: 123.45, finalWin: 200});
    });

    test("play states chain", async () => {
        //round 1
        const {token} = await authenticate();
        const body0 = await play(token, "main", 100, ["second"], undefined, () => ({i: 0, _x: 123}));
        expect(body0).toEqual({balance: 123, roundId: expect.any(String), wager: {state: {i: 0}, win: 100, data: {test: true}, next: ["second"]}});
        const body1 = await play(token, "second", undefined, undefined, body0.roundId, ({i}) => ({i: 1, prev: i, _x: 123}));
        expect(body1).toEqual({balance: undefined, roundId: expect.any(String), wager: {state: {i: 1, prev: 0}, win: 100, data: {test: true}}});
        const body2 = await complete(token, body0.roundId);
        expect(body2).toEqual({balance: 123.45, finalWin: 200});

        //info 1
        const info1 = await request(api).get("/game/info?game=test-game&provider=test-provider").auth(token, {type: "bearer"}).expect(200);
        expect(info1.body.state).toEqual({i: 1, prev: 0});

        //round 2
        const body3 = await play(token, "main", 100, ["second"], undefined, ({i}) => ({i: 2, prev: i, _x: 123}));
        expect(body3).toEqual({balance: 123, roundId: expect.any(String), wager: {state: {i: 2, prev: 1}, win: 100, data: {test: true}, next: ["second"]}});
        const body4 = await play(token, "second", undefined, undefined, body3.roundId, ({i}) => ({i: 3, prev: i, _x: 123}));
        expect(body4).toEqual({balance: undefined, roundId: expect.any(String), wager: {state: {i: 3, prev: 2}, win: 100, data: {test: true}}});

        //info 2
        const info2 = await request(api).get("/game/info?game=test-game&provider=test-provider").auth(token, {type: "bearer"}).expect(200);
        expect(info2.body.state).toEqual({i: 3, prev: 2});

        //recover
        const recover = await request(api).post("/game/recover").auth(token, {type: "bearer"}).send({provider: "test-provider", game: "test-game"}).expect(200);
        expect(recover.body.rounds[0].previousState).toEqual({i: 1, prev: 0});
        expect(recover.body.rounds[0].wagers.at(-1).state).toEqual({i: 3, prev: 2});
    });

    test("play and complete with different player", async () => {
        const auth1 = await authenticate();
        const auth2 = await authenticate();
        const body = await play(auth1.token, "main", 100);
        expect(body).toEqual({balance: 123, roundId: expect.any(String), wager: {state: {s: 1}, win: 100, data: {test: true}}});
        const body2 = await complete(auth2.token, body.roundId);
        expect(body2).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and complete unfinished round", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main", 100, ["second"]);
        const body2 = await complete(token, body.roundId);
        expect(body2).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and play with unfinished round", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main", 100, ["second"]);
        const body2 = await play(token, "main", 100, ["second"]);
        expect(body).toEqual({balance: 123, roundId: expect.any(String), wager: {state: {s: 1}, win: 100, data: {test: true}, next: ["second"]}});
        expect(body2).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and next with different game", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        const body = await play(token, "second", undefined, undefined, roundId, undefined, undefined, "test-game2");
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and next with completed round", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        await play(token, "second", undefined, undefined, roundId);
        const body = await play(token, "second", undefined, undefined, roundId);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and next with wrong action", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        const body = await play(token, "wrong-action", undefined, ["second"], roundId);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and next with different player", async () => {
        const auth1 = await authenticate();
        const auth2 = await authenticate();
        const {roundId} = await play(auth1.token, "main", 100, ["second"]);
        const body = await play(auth2.token, "second", undefined, undefined, roundId);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play with altered UUID", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        const body = await play(token, "second", undefined, undefined, roundId.toUpperCase());
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play - failed game", async () => {
        const {token} = await authenticate();
        const data = {provider: "test-provider", game: "test-game", bet: 100, action: "main"};
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1}}});
            if ((url as string).indexOf("/transaction") >= 0) return Promise.resolve({balance: 123});
            if ((url as string).indexOf("/cancel") >= 0) return Promise.resolve({balance: 123});
            if ((url as string).indexOf("/play") >= 0) return Promise.reject(new Error());
            if ((url as string).indexOf("/api/sessions") >= 0) return Promise.resolve({});
        });

        const {body} = await request(api).post("/game/play").send(data).auth(token, {type: "bearer"});
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
        const [round] = await Round.find({order: {createdAt: "DESC"}});
        expect(round).toMatchObject({status: "cancelled"});
    });

    test("play - failed bet", async () => {
        const {token} = await authenticate();
        const data = {provider: "test-provider", game: "test-game", bet: 100, action: "main"};
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1}}});
            if ((url as string).indexOf("/transaction") >= 0) return Promise.reject(new Exception("failed transaction"));
            if ((url as string).indexOf("/play") >= 0) return Promise.resolve({win: 100, data: {test: true}, state: {s: 1, _s: 2}});
            if ((url as string).indexOf("/cancel") >= 0) return Promise.resolve({balance: 123});
            if ((url as string).indexOf("/api/sessions") >= 0) return Promise.resolve({});
        });

        const {body} = await request(api).post("/game/play").send(data).auth(token, {type: "bearer"});
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
        await wait(100);
        const [round] = await Round.find({order: {createdAt: "DESC"}});
        expect(round).toMatchObject({status: "cancelled"});
    });

    test("play - not existing transaction", async () => {
        const {token} = await authenticate();
        const data = {provider: "test-provider", game: "test-game", bet: 100, action: "main"};
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1}}});
            if ((url as string).indexOf("/transaction") >= 0) return Promise.reject(new Exception("failed transaction"));
            if ((url as string).indexOf("/play") >= 0) return Promise.resolve({win: 100, data: {test: true}, state: {s: 1, _s: 2}});
            if ((url as string).indexOf("/cancel") >= 0) return Promise.reject(new Exception("Transaction not found", {code: "TRANSACTION_NOT_FOUND"}));
            if ((url as string).indexOf("/api/sessions") >= 0) return Promise.resolve({});
        });

        const {body} = await request(api).post("/game/play").send(data).auth(token, {type: "bearer"});
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
        await wait(100);
        const [round] = await Round.find({order: {createdAt: "DESC"}});
        expect(round).toMatchObject({status: "cancelled"});
    });

    test("play and win floor", async () => {
        const {token} = await authenticate();
        const data = {provider: "test-provider", game: "test-game", bet: 100, action: "main"};
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1, coin: 2}}});
            if ((url as string).indexOf("/transaction") >= 0) return Promise.resolve({balance: 123});
            if ((url as string).indexOf("/play") >= 0) return Promise.resolve({win: 100.06999});
            if ((url as string).indexOf("/api/games") >= 0) return Promise.resolve({"test-provider": ["test-game"]});
            if ((url as string).indexOf("/api/sessions") >= 0) return Promise.resolve({});
        });

        const {body} = await request(api).post("/game/play").send(data).auth(token, {type: "bearer"});
        expect(body.wager).toMatchObject({win: 100.06});
    });

    test("play - incorrect action", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main123", 100, ["second"]);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play - bet not available", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main", 123, ["second"]);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play - incorrect bet", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main", 0, ["second"]);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play - incorrect bet below 0", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main", -1, ["second"]);
        expect(body).toEqual({error: {message: "Application Error", code: "VALIDATION_FAILED"}});
    });

    test("play - incorrect bet non main action", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main2", 0, ["second"]);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and play - incorrect action", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        const body = await play(token, "main", 100, ["third"], roundId);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and complete - exploit with duplicated next plays", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        const bodies = await Promise.all([play(token, "second", undefined, undefined, roundId), play(token, "second", undefined, undefined, roundId)]);
        bodies.sort(a => (a.error ? 1 : -1)); //errors second
        expect(bodies[0]).toEqual({balance: undefined, roundId: expect.any(String), wager: {state: {s: 1}, win: 100, data: {test: true}}});
        expect(bodies[1]).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});

        const body2 = await complete(token, roundId);
        expect(body2).toEqual({balance: 123.45, finalWin: 200});
    });

    test("play and complete - exploit with duplicated plays", async () => {
        const {token} = await authenticate();

        const bodies = await Promise.all([play(token, "main", 100), play(token, "main", 100), play(token, "main", 100), play(token, "main", 100)]);
        bodies.sort(a => (a.error ? 1 : -1)); //errors second
        expect(bodies[0]).toEqual({balance: 123, roundId: expect.any(String), wager: {state: {s: 1}, win: 100, data: {test: true}}});
        expect(bodies[1]).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
        expect(bodies[2]).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
        expect(bodies[3]).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});

        const body2 = await complete(token, bodies[0].roundId);
        expect(body2).toEqual({balance: 123.45, finalWin: 100});
    });

    test("play - unpaid round not expired", async () => {
        const token = await forceUnpaidRound();
        const body = await play(token, "main", 100);
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play - unpaid round expired", async () => {
        await Settings.create({priority: 100, key: "retriesExpiryHours", value: "0.000001", serverOnly: true}).save();
        invalidate("settings");

        const token = await forceUnpaidRound();

        await wait(10);
        const body = await play(token, "main", 100);
        expect(body).toEqual({
            balance: 123,
            roundId: expect.any(String),
            wager: {state: {s: 1}, win: 100, data: {test: true}},
        });

        await Settings.delete({key: "retriesExpiryHours"});
        invalidate("settings");
    });

    test("play and complete with altered UUID", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["second"]);
        await play(token, "second", undefined, undefined, roundId);
        const body = await complete(token, roundId.toUpperCase());
        expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play and complete - exploit with duplicated completes", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100);
        const bodies = await Promise.all([complete(token, roundId), complete(token, roundId)]);
        bodies.sort(a => (a.error ? 1 : -1)); //errors second
        expect(bodies[0]).toEqual({balance: 123.45, finalWin: 100});
        expect(bodies[1]).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
    });

    test("play with cheat - production environment", async () => {
        const {token} = await authenticate();
        await play(token, "main", 100, undefined, undefined, undefined, "my-cheat");
        const playRequestBody = JSON.parse(getPlayCallBody(mockedFetch));
        expect(playRequestBody?.cheat).toBeNull();
    });

    test("play with cheat - development environment", async () => {
        process.env.IS_PRODUCTION = "false";

        const {token} = await authenticate();
        await play(token, "main", 100, undefined, undefined, undefined, "my-cheat");
        const playRequestBody = JSON.parse(getPlayCallBody(mockedFetch));
        expect(playRequestBody?.cheat).toEqual("my-cheat");
    });

    function getPlayCallBody(mockedFetch: jest.MockedFunction<typeof fetchAndParse>): string {
        const playCall = mockedFetch.mock.calls.find(call => (call[0] as string).indexOf("/play") >= 0);
        if (playCall === undefined) {
            throw new TypeError("Play call not found in registered calls");
        }

        return playCall[1]?.body as string;
    }

    test("info", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100);
        await complete(token, roundId);
        const {body} = await request(api).get("/game/info?game=test-game&provider=test-provider").auth(token, {type: "bearer"}).expect(200);
        expect(body).toEqual({
            state: {s: 1},
            settings: {},
            bets: {
                main: {available: [100], default: 100, coin: 2},
                main2: {available: [5000], default: 5000, coin: 50},
            },
            betLimits: {currencyRate: 10, exchangeRate: 11.07, minBet: 0.1, maxBet: 100000, maxExposure: 100000000, currencyDecimals: 2, currencyUnit: 0.01},
        });
    });

    test("info - exchange rate bet limits", async () => {
        await Settings.create({priority: 100, key: "useExchangeRateBetLimits", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100);
        await complete(token, roundId);
        const {body} = await request(api).get("/game/info?game=test-game&provider=test-provider").auth(token, {type: "bearer"}).expect(200);
        expect(body).toEqual({
            state: {s: 1},
            settings: {},
            bets: {
                main: {available: [100], default: 100, coin: 2},
                main2: {available: [5000], default: 5000, coin: 50},
            },
            betLimits: {currencyRate: 10, exchangeRate: 11.07, minBet: 0.1, maxBet: 110700, maxExposure: 110700000, currencyDecimals: 2, currencyUnit: 0.01},
        });
        await Settings.delete({key: "useExchangeRateBetLimits"});
        invalidate("settings");
    });

    test("cheats - production environment", async () => {
        const cheats = {main: ["a"]};
        mockResponse(cheats);
        await request(api).get("/game/cheats?game=test-game&provider=test-provider").expect(404);
    });

    test("cheats - development environment", async () => {
        process.env.IS_PRODUCTION = "false";

        const cheats = {main: ["a"]};
        mockResponse(cheats);
        const {body} = await request(api).get("/game/cheats?game=test-game&provider=test-provider").expect(200);
        expect(body).toEqual({cheats});
    });

    test("recover", async () => {
        const {token} = await authenticate();
        const play1 = await play(token, "main", 100, undefined, undefined, () => ({s: 1}));
        await complete(token, play1.roundId);
        const play2 = await play(token, "main", 100);
        const {body} = await request(api).post("/game/recover").auth(token, {type: "bearer"}).send({provider: "test-provider", game: "test-game"}).expect(200);
        const wagers = [{...play2.wager, action: "main", bet: 100, win: 100, state: {s: 1}, next: null, params: null, createdAt: expect.any(String)}];
        expect(body).toEqual({rounds: [{roundId: play2.roundId, wagers, previousState: {s: 1}}]});
    });

    test("recover - no rounds", async () => {
        const {token} = await authenticate();
        const {body} = await request(api).post("/game/recover").auth(token, {type: "bearer"}).send({provider: "test-provider", game: "test-game"}).expect(200);
        expect(body).toEqual({rounds: []});
    });

    test("replay", async () => {
        const {token, currency} = await authenticate();
        const play1 = await play(token, "main", 100, undefined, undefined, () => ({s: 0}));
        await complete(token, play1.roundId);
        const play2 = await play(token, "main", 100);
        await complete(token, play2.roundId);
        mockResponse({playerId: v4(), currency: "sek"});
        mockResponse({playerId: v4(), currency: "sek"});
        mockResponse({value: 123});
        mockResponse({roundBalance: {[play2.roundId]: {balanceBefore: 999, balanceAfter: 1000}}});
        mockResponse({data: {session: "my-sesison"}});
        const {body} = await request(api)
            .get("/game/replay?roundId=" + play2.roundId)
            .expect(200);
        const wagers = [{...play2.wager, action: "main", bet: 100, win: 100, state: {s: 1}, next: null, params: null, createdAt: expect.any(String)}];
        expect(body).toEqual({
            currency,
            currencyDecimals: 2,
            currencySymbol: currency,
            bet: 100,
            win: 100,
            balanceBefore: 999,
            balanceAfter: 1000,
            state: {s: 1},
            settings: {},
            config: {value: 123},
            bets: {main: {available: [100], default: 100, coin: 2}, main2: {available: [5000], default: 5000, coin: 50}},
            round: {roundId: play2.roundId, wagers, previousState: {s: 0}},
            sessionData: {session: "my-sesison"},
            betLimits: {currencyRate: 10, exchangeRate: 11.07, minBet: 0.1, maxBet: 100000, maxExposure: 100000000, currencyDecimals: 2, currencyUnit: 0.01},
        });
    });

    test("history", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100);
        await complete(token, roundId);
        mockResponse({roundBalance: {[roundId]: {balanceBefore: 999, balanceAfter: 1000}}});
        const {body} = await request(api).get("/game/history?game=test-game&provider=test-provider&page=0").auth(token, {type: "bearer"}).expect(200);
        expect(body).toEqual({hasPrev: false, hasNext: false, data: [{bet: 100, createdAt: expect.any(String), roundId, win: 100, balanceBefore: 999, balanceAfter: 1000}]});
    });

    test("autoComplete - no next", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100);
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/players") >= 0) return Promise.resolve({currency: "sek"});
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1, coin: 2}, main2: {available: [500], maxWin: 5, minBet: 5, coin: 50}}});
            if ((url as string).indexOf("/transaction") >= 0) return Promise.resolve({balance: 123});
        });
        const createdAt = new Date();
        createdAt.setHours(createdAt.getHours() - 25);
        await Round.update({roundId}, {createdAt});

        await request(api).post("/api/autoCompleteRound").send({roundId}).expect(200);

        const round = await Round.findOneBy({roundId});
        expect(round?.status).toEqual("finished");
    });

    test("autoComplete - next", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["next"]);
        const createdAt = new Date();
        createdAt.setHours(createdAt.getHours() - 25);
        await Round.update({roundId}, {createdAt});

        let nextCount = 2;
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1}}});
            if ((url as string).indexOf("/transaction") >= 0) return Promise.resolve({balance: 123});
            if ((url as string).indexOf("/players") >= 0) return Promise.resolve({currency: "sek"});
            if ((url as string).indexOf("/play") >= 0) return Promise.resolve({win: 100, data: {test: true}, next: --nextCount > 0 ? ["next"] : null});
            if ((url as string).indexOf("/action") >= 0) return Promise.resolve({action: "next"});
        });

        await request(api).post("/api/autoCompleteRound").send({roundId}).expect(200);

        const round = await Round.findOneBy({roundId});
        const wagers = await Wager.findBy({roundId});
        expect(round?.status).toEqual("finished");
        expect(wagers[wagers.length - 1].auto).toEqual(true);
    });

    test("autoComplete", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["next"]);

        let nextCount = 2;
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1}}});
            if ((url as string).indexOf("/transaction") >= 0) return Promise.resolve({balance: 123});
            if ((url as string).indexOf("/players") >= 0) return Promise.resolve({currency: "sek"});
            if ((url as string).indexOf("/play") >= 0) return Promise.resolve({win: 100, data: {test: true}, next: --nextCount > 0 ? ["next"] : null});
            if ((url as string).indexOf("/action") >= 0) return Promise.resolve({action: "next"});
        });

        await request(api).post("/api/autoCompleteRound").send({roundId}).expect(200);

        const round = await Round.findOneBy({roundId});
        expect(round?.status).toEqual("finished");
    });

    test("games", async () => {
        mockResponse({"test-provider": ["test-game", "game2", "test-game-disabled", "test-game2"]});
        const res2 = await request(api).get("/games").expect(200);
        expect(res2.body).toEqual({"test-provider": ["test-game", "game2", "test-game-disabled", "test-game2"]});
    });

    test("currencyDecimals - authenticated", async () => {
        await Currency.insert({currency: "myprize-sc", fixedRate: 1, decimals: 2, symbol: "SC"});
        await Settings.insert({priority: 100, key: "maxDecimals", value: "5", serverOnly: true, wallets: ["test-wallet"]});
        await Currency.insert({currency: "btc", fixedRate: 0.00001, decimals: 8, symbol: "BTC"});
        invalidate("settings");
        invalidate("currency");
        await wait(50);

        const {token} = await authenticate();
        const res = await request(api).get("/currencyDecimals").auth(token, {type: "bearer"}).expect(200);
        Object.entries(res.body).forEach(([currency, decimal]) => {
            expect(typeof currency).toBe("string");
            expect(Number.isInteger(decimal)).toEqual(true);
        });

        expect(res.body["SC"]).toBeUndefined();
        expect(res.body["myprize-sc"]).toBe(2);
        expect(res.body["btc"]).toBe(5);
    });

    test("currencyDecimals - public", async () => {
        await Settings.insert({priority: 100, key: "maxDecimals", value: "5", serverOnly: true, wallets: ["test-wallet"]});
        await Currency.insert({currency: "btc2", fixedRate: 0.00001, decimals: 8, symbol: "BTC2"});
        invalidate("settings");
        invalidate("currency");
        await wait(50);

        const res = await request(api).get("/currencyDecimals").expect(200);
        expect(res.body["btc2"]).toBe(2);
    });

    test("currencyDecimals - player id", async () => {
        await Settings.insert({priority: 100, key: "maxDecimals", value: "4", serverOnly: true, wallets: ["test-wallet-btc3"]});
        await Currency.insert({currency: "btc3", fixedRate: 0.00001, decimals: 8, symbol: "BTC3"});
        invalidate("settings");
        invalidate("currency");
        await wait(50);

        mockResponse({wallet: "test-wallet-btc3"});

        const res = await request(api).get("/currencyDecimals?playerId=a7f413b8-df63-4823-88bf-07492f33be57").expect(200);
        expect(res.body["btc3"]).toBe(4);
    });

    test("convertBet", async () => {
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1, coin: 2}, main2: {available: [10], maxWin: 100, minBet: 0.1, coin: 50}}});
        });
        const params = new URLSearchParams({currencyFrom: "eur", currencyTo: "sek", amount: "10", provider: "test-provider", game: "test-game", wallet: "test-wallet"});
        const {body} = await request(api)
            .get("/api/convertBet?" + params.toString())
            .expect(200);
        expect(body).toEqual({converted: 100});
    });

    test("convertBet - not supported currency", async () => {
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1, coin: 2}, main2: {available: [10], maxWin: 100, minBet: 0.1, coin: 50}}});
        });
        const params = new URLSearchParams({currencyFrom: "xyz", currencyTo: "eur", amount: "10", provider: "test-provider", game: "test-game", wallet: "test-wallet"});
        const {body} = await request(api)
            .get("/api/convertBet?" + params.toString())
            .expect(400);
        expect(body).toEqual({error: {code: "CURRENCY_NOT_SUPPORTED", message: "Application Error"}});
    });

    test("convertBet - not supported bet", async () => {
        mockedFetch.mockImplementation(async url => {
            if ((url as string).indexOf("/bets") >= 0) return Promise.resolve({bets: {main: {available: [10], maxWin: 100, minBet: 0.1, coin: 2}, main2: {available: [10], maxWin: 100, minBet: 0.1, coin: 50}}});
        });
        const params = new URLSearchParams({currencyFrom: "sek", currencyTo: "eur", amount: "999", provider: "test-provider", game: "test-game", wallet: "test-wallet"});
        const {body} = await request(api)
            .get("/api/convertBet?" + params.toString())
            .expect(400);
        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });

    test("win ratio", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100);
        await complete(token, roundId);

        const {body} = await request(api).post("/api/evaluate").send({type: "winRatio", roundId}).expect(200);
        expect(body).toEqual({winRatio: 1, win: 100, bet: 100});
    });

    test("win ratio - non main", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main2", 5000);
        await complete(token, roundId);

        const {body} = await request(api).post("/api/evaluate").send({type: "winRatio", roundId}).expect(200);
        expect(body).toEqual({winRatio: 0.5, win: 100, bet: 5000});
    });

    test("validate (initial bet) - false", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main2", 5000, undefined, undefined, undefined, undefined, "test-game", false);

        expect(body).toEqual({error: {code: "VALIDATION_FAILED", message: "Application Error"}});
    });

    test("validate (initial bet) - true", async () => {
        const {token} = await authenticate();
        const body = await play(token, "main2", 5000, undefined, undefined, undefined, undefined, "test-game", true);

        expect(body).toMatchObject({balance: 123});
    });

    test("validate (side bet) - false", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["sideBet"], undefined, undefined, undefined, "test-game", false);
        const body = await play(token, "sideBet", 123, ["sideBet"], roundId, undefined, undefined, "test-game", false);

        expect(body).toEqual({error: {code: "VALIDATION_FAILED", message: "Application Error"}});
    });

    test("validate (side bet) - true", async () => {
        const {token} = await authenticate();
        const {roundId} = await play(token, "main", 100, ["sideBet"], undefined, undefined, undefined, "test-game", false);
        const body = await play(token, "sideBet", 123, ["sideBet"], roundId, undefined, undefined, "test-game", true);

        expect(body).toMatchObject({balance: 123});
    });

    test("parallel rounds", async () => {
        await Settings.create({priority: 100, key: "parallelRounds", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();
        const plays = [];

        for (let i = 0; i < 50; i++) {
            plays.push(
                play(token, "main", 100, undefined, undefined, prevState => {
                    return {i: prevState ? prevState.i + 1 : 0, prev: prevState?.i};
                }),
            );
        }
        const bodies = await Promise.all(plays);
        bodies.sort((a, b) => a.wager.state.i - b.wager.state.i);

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            expect(body.wager.state.i).toEqual(i);
            expect(body.wager.state.prev).toEqual(i === 0 ? undefined : i - 1);
            expect(body).toMatchObject({balance: expect.any(Number)});
        }
    });

    test("parallel rounds - next", async () => {
        await Settings.create({priority: 100, key: "parallelRounds", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();
        const plays = [];

        for (let i = 0; i < 10; i++) {
            plays.push(
                play(token, "main", 100, ["second"], undefined, prevState => {
                    return {i: prevState ? prevState.i + 1 : 0, prev: prevState?.i};
                }),
            );
        }
        const bodies = await Promise.all(plays);
        bodies.sort(a => (a.error ? 1 : -1)); //errors second

        expect(bodies[0]).toEqual({balance: 123, roundId: expect.any(String), wager: {state: {i: 0}, win: 100, data: {test: true}, next: ["second"]}});
        for (let i = 1; i < bodies.length; i++) {
            const body = bodies[i];
            expect(body).toEqual({error: {message: "Application Error", code: "APPLICATION_ERROR"}});
        }
    });

    test("archive", async () => {
        await Round.clear();
        await Wager.clear();

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const {token} = await authenticate();

        //play1 - should be archived because it's older than one year
        const play1 = await play(token, "main", 100);
        await complete(token, play1.roundId);
        await Round.update({roundId: play1.roundId}, {createdAt: oneYearAgo});

        //play2 - should NOT be archived because it's not older than one year
        const play2 = await play(token, "main", 100);
        await complete(token, play2.roundId);

        //play3 - should NOT be archived because it's not finished
        const play3 = await play(token, "main", 100);
        await Round.update({roundId: play3.roundId}, {createdAt: oneYearAgo});

        //start archiving
        const {archiveSinglePlayer, archiveMultiplayer} = await import("../route/archive");
        await archiveSinglePlayer();
        await archiveMultiplayer();

        expect((await RoundArchive.find({})).map(r => r.roundId)).toEqual([play1.roundId]);
        expect((await WagerArchive.find({})).map(r => r.roundId)).toEqual([play1.roundId]);

        expect((await Round.find({})).map(r => r.roundId)).toEqual([play2.roundId, play3.roundId]);
        expect((await Wager.find({})).map(r => r.roundId)).toEqual([play2.roundId, play3.roundId]);
    });

    test("play provably fair - newRngCursor not greater then current, but closed round sends close request", async () => {
        await Settings.create({priority: 100, key: "provablyFair", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();
        await play(token, "main", 100, undefined, undefined, undefined, undefined, undefined, undefined, {newRngCursor: 10});

        const call = mockedFetch.mock.calls.find(call => (call[0] as string).indexOf("/updateRoundRngCursor") >= 0)!;
        expect(JSON.parse(call[1]?.body as string)).toEqual({roundId: expect.any(String), cursor: 10, closed: true});
    });

    test("play provably fair - round open but cursor updated sends update request", async () => {
        await Settings.create({priority: 100, key: "provablyFair", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();
        await play(token, "main", 100, ["continue"], undefined, undefined, undefined, undefined, undefined, {newRngCursor: 11});
        const call = mockedFetch.mock.calls.find(call => (call[0] as string).indexOf("/updateRoundRngCursor") >= 0)!;
        expect(JSON.parse(call[1]?.body as string)).toEqual({roundId: expect.any(String), cursor: 11, closed: false});
    });

    test("play provably fair - no rngPayload  for provably fair game throws error", async () => {
        await Settings.create({priority: 100, key: "provablyFair", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();
        const response = await play(token, "main", 100);

        expect(response.error).toEqual({
            message: "Application Error",
            code: "APPLICATION_ERROR",
        });
    });

    test("play provably fair - no newRngCursor for provably fair game throws error", async () => {
        await Settings.create({priority: 100, key: "provablyFair", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();
        const response = await play(token, "main", 100, undefined, undefined, undefined, undefined, undefined, undefined, {newRngCursor: undefined});

        expect(response.error).toEqual({
            message: "Application Error",
            code: "APPLICATION_ERROR",
        });
    });

    test("play provably fair - round open and no/lower cursor updated doesn't send update request", async () => {
        await Settings.create({priority: 100, key: "provablyFair", value: "true", serverOnly: true}).save();
        invalidate("settings");
        const {token} = await authenticate();

        const {roundId} = await play(token, "main", 100, ["continue"], undefined, undefined, undefined, undefined, undefined, {newRngCursor: 10});
        let call = mockedFetch.mock.calls.find(call => (call[0] as string).indexOf("/updateRoundRngCursor") >= 0)!;
        expect(call).toBeUndefined();

        await play(token, "continue", 100, ["continue"], roundId, undefined, undefined, undefined, undefined, {newRngCursor: 10});
        call = mockedFetch.mock.calls.find(call => (call[0] as string).indexOf("/updateRoundRngCursor") >= 0)!;
        expect(call).toBeUndefined();

        await play(token, "continue", 100, undefined, roundId, undefined, undefined, undefined, undefined, {newRngCursor: 10});
        call = mockedFetch.mock.calls.find(call => (call[0] as string).indexOf("/updateRoundRngCursor") >= 0)!;
        expect(JSON.parse(call[1]?.body as string)).toEqual({roundId: expect.any(String), cursor: 10, closed: true});
    });
});
