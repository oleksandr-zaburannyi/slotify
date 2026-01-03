import {afterAll, beforeAll, describe, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {Player} from "../db/model/Player";
import {Transaction} from "../db/model/Transaction";
import {v4} from "uuid";
import {Session} from "../db/model/Session";
import {RoundVerification} from "../db/model/RoundVerification";
import {TransactionArchive} from "../db/model/TransactionArchive";
import {SessionArchive} from "../db/model/SessionArchive";
import {RoundVerificationArchive} from "../db/model/RoundVerificationArchive";
import {cleanupAfterTests} from "./cleanup";
import archive from "../route/archive";

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));

describe("general", () => {
    test("health", async () => {
        const {text} = await request(api).get("/health").expect(200);
        expect(text).toEqual("OK");
    });

    test("404", async () => {
        const {body} = await request(api).get("/non-existing-path").expect(404);
        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });

    test("player (playerId)", async () => {
        const {createdAt, updatedAt, ...player} = await Player.create({nativeId: "native-id-1", currency: "eur", wallet: "standard-wallet", operator: "test-operator", brand: "brand", group: "a"}).save();
        const {body} = await request(api)
            .get("/api/players/" + player.id)
            .expect(200);
        expect(body).toEqual({...player, blocked: null, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString()});
    });

    test("player (wallet & nativeId)", async () => {
        const {createdAt, updatedAt, ...player} = await Player.create({nativeId: "native-id-2", currency: "eur", wallet: "standard-wallet", operator: "test-operator", brand: "brand", group: "a"}).save();
        const {body} = await request(api)
            .get("/api/players/" + player.wallet + "/" + player.nativeId)
            .expect(200);
        expect(body).toEqual({...player, blocked: null, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString()});
    });

    test("block player", async () => {
        const {id} = await Player.create({nativeId: "native-id-3", currency: "eur", wallet: "standard-wallet", operator: "test-operator", brand: "brand", group: "a"}).save();
        await request(api).post(`/api/players/${id}/block`).expect(200);
        const {blocked} = await Player.findOneByOrFail({id});
        expect(blocked).toEqual(true);
    });

    test("balanceAfter", async () => {
        await Transaction.insert({playerId: v4(), game: "test", provider: "test", amount: 10, balanceAfter: 123, roundId: "r1", type: "withdraw", status: "finished", auto: false});
        await Transaction.insert({playerId: v4(), game: "test", provider: "test", amount: 10, balanceAfter: 133, roundId: "r1", type: "deposit", status: "finished", auto: false});
        await Transaction.insert({playerId: v4(), game: "test", provider: "test", amount: 10, balanceAfter: 456, roundId: "r2", type: "withdraw", status: "finished", auto: false});
        await Transaction.insert({playerId: v4(), game: "test", provider: "test", amount: 10, balanceAfter: 456, roundId: "r2", type: "deposit", status: "finished", auto: false});
        const {body} = await request(api)
            .post("/api/roundBalance/")
            .send({roundIds: ["r1", "r2"]})
            .expect(200);
        expect(body).toEqual({roundBalance: {r1: {balanceBefore: 133, balanceAfter: 133}, r2: {balanceBefore: 466, balanceAfter: 456}}});
    });

    test("archive", async () => {
        await Transaction.clear();
        await Session.clear();
        await RoundVerification.clear();

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        //sessions
        const oldSession = await Session.create({playerId: v4(), game: "a", lastActivity: new Date(), token: "123", active: false, endedAt: oneYearAgo, data: {}, lastFail: new Date(), ip: "x", provider: "a", key: "a"}).save();
        const activeSession = await Session.create({playerId: v4(), game: "a", lastActivity: new Date(), token: "123", active: true, endedAt: oneYearAgo, data: {}, lastFail: new Date(), ip: "x", provider: "a", key: "b"}).save();
        const newSession = await Session.create({playerId: v4(), game: "a", lastActivity: new Date(), token: "123", active: false, endedAt: new Date(), data: {}, lastFail: new Date(), ip: "x", provider: "a", key: "c"}).save();

        //transactions
        const oldTransaction = await Transaction.create({
            game: "a",
            provider: "b",
            rgsTransactionId: "x",
            rgsRoundId: "xx",
            type: "deposit",
            status: "finished",
            playerId: v4(),
            roundId: v4(),
            auto: true,
            createdAt: oneYearAgo,
            sessionId: v4(),
        }).save();
        const unfinishedTransaction = await Transaction.create({
            game: "a",
            provider: "b",
            rgsTransactionId: "x",
            rgsRoundId: "xx",
            type: "deposit",
            status: "failed",
            playerId: v4(),
            roundId: v4(),
            auto: true,
            createdAt: oneYearAgo,
            sessionId: v4(),
        }).save();
        const newTransaction = await Transaction.create({
            game: "a",
            provider: "b",
            rgsTransactionId: "x",
            rgsRoundId: "xx",
            type: "deposit",
            status: "finished",
            playerId: v4(),
            roundId: v4(),
            auto: true,
            sessionId: v4(),
        }).save();

        //round verifications
        const oldVerification = await RoundVerification.create({roundId: oldTransaction.roundId, action: "passed", score: 0, details: {}}).save();
        const newVerification = await RoundVerification.create({roundId: newTransaction.roundId, action: "passed", score: 0, details: {}}).save();

        //start archiving
        await archive();

        expect(await TransactionArchive.find({})).toEqual([oldTransaction]);
        expect(await Transaction.find({})).toEqual([unfinishedTransaction, newTransaction]);

        expect(await SessionArchive.find({})).toEqual([oldSession]);
        expect(await Session.find({})).toEqual([activeSession, newSession]);

        expect(await RoundVerificationArchive.find({})).toEqual([oldVerification]);
        expect(await RoundVerification.find({})).toEqual([newVerification]);
    });
});
