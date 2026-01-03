import {setEnvVariables} from "./setEnvVariables";

setEnvVariables();

import {v4} from "uuid";
import {afterAll, beforeAll, describe, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {closeDatabase, closeServer, createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import auth from "@slotify/shared/lib/middleware/jwtAuth";
import {generateSeedHash} from "../fairness/generateSeed";
import {closeRedis} from "@slotify/shared/lib/redis";

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("../verify", () => ({verify: jest.requireActual("../verify").verify, setPeriodicVerification: jest.fn}));
jest.mock("../cycle", () => ({cycle: jest.requireActual("../cycle").cycle, setBackgroundCycling: jest.fn}));
jest.mock("../seed", () => ({seed: jest.requireActual("../seed").seed, setPeriodicReseeding: jest.fn}));

let api: Express;

beforeAll(async () => {
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await closeDatabase();
    await closeServer();
    await closeRedis();
});

const TESTS_TIMEOUT = 0;

function createPlayer() {
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
    return player;
}

describe("fairness", () => {
    const game = "test-game";

    test(
        "initPlayerSeeds affects player only once",
        async () => {
            const player = createPlayer();

            const {body: initPlayerSeedsBody} = await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);
            expect(initPlayerSeedsBody.success).toEqual(true);

            const {body: activeRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"});

            expect(activeRngSeedsBody).toEqual({
                clientSeed: expect.any(String),
                nextServerSeedHash: expect.any(String),
                nonce: 0,
                serverSeedHash: expect.any(String),
                unfinishedGames: [],
            });

            const {body: secondInitPlayerSeedsBody} = await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);
            expect(secondInitPlayerSeedsBody.success).toEqual(true);

            const {body: secondActiveRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"});

            expect(secondActiveRngSeedsBody).toEqual(activeRngSeedsBody);
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateClientSeed uses nextServerSeedHash",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const {body: activeRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"});

            const {body: updateClientSeedBody} = await request(api).post("/fairness/updateClientSeed").send({clientSeed: "new-test-seed"}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);
            expect(updateClientSeedBody).toEqual({
                clientSeed: "new-test-seed",
                serverSeedHash: expect.any(String),
                nextServerSeedHash: expect.any(String),
                nonce: 0,
                unfinishedGames: [],
            });

            const {body: newActiveRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);

            expect(newActiveRngSeedsBody.serverSeedHash).toEqual(activeRngSeedsBody.nextServerSeedHash);

            expect(newActiveRngSeedsBody).toEqual(updateClientSeedBody);
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateClientSeed reveals previous seeds",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const {body: activeRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);

            const roundId = v4();
            const {body: getRoundRngStateBody} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game}).expect(200);

            expect(activeRngSeedsBody.clientSeed).toEqual(getRoundRngStateBody.clientSeed);
            expect(activeRngSeedsBody.serverSeedHash).toEqual(generateSeedHash(getRoundRngStateBody.serverSeed));
            expect(activeRngSeedsBody.nonce).toEqual(getRoundRngStateBody.nonce);
            expect(getRoundRngStateBody.nonce).toEqual(0);

            const {body: roundRngStateBody} = await request(api).get("/fairness/roundRngState").query({roundId}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);

            expect(roundRngStateBody).toEqual({
                clientSeed: activeRngSeedsBody.clientSeed,
                serverSeedHash: activeRngSeedsBody.serverSeedHash,
                nextServerSeedHash: activeRngSeedsBody.nextServerSeedHash,
                nonce: activeRngSeedsBody.nonce,
                status: "active",
            });
            expect(roundRngStateBody.serverSeed).toBeUndefined();

            const {body: closeRoundRngStateBody} = await request(api).post("/api/fairness/closeRoundRngState").send({roundId}).expect(200);
            expect(closeRoundRngStateBody.success).toEqual(true);

            const {body: updateClientSeedBody} = await request(api).post("/fairness/updateClientSeed").send({clientSeed: "new-test-seed"}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);

            const {body: revealedRoundRngStateBody} = await request(api).get("/fairness/roundRngState").query({roundId}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);

            expect(revealedRoundRngStateBody).toEqual({
                clientSeed: getRoundRngStateBody.clientSeed,
                serverSeed: getRoundRngStateBody.serverSeed,
                serverSeedHash: generateSeedHash(revealedRoundRngStateBody.serverSeed),
                nextServerSeedHash: updateClientSeedBody.serverSeedHash,
                nonce: getRoundRngStateBody.nonce,
                status: "revealed",
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateClientSeed blocked while rounds are active",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const roundId = v4();
            await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});

            const {body: updateClientSeedBody} = await request(api).post("/fairness/updateClientSeed").send({clientSeed: "new-test-seed"}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(400);

            expect(updateClientSeedBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Unable to update client seed when there are active game rounds.",
                },
            });

            const {body: activeRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);
            expect(activeRngSeedsBody.unfinishedGames).toContain("test-game");
        },
        TESTS_TIMEOUT,
    );

    test(
        "getRoundRngState on closed round state error",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const roundId = v4();
            await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});

            const {body: closeRoundRngStateBody} = await request(api).post("/api/fairness/closeRoundRngState").send({roundId}).expect(200);
            expect(closeRoundRngStateBody.success).toEqual(true);

            const {body: roundRngState} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game}).expect(400);
            expect(roundRngState).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Fair RNG state inconsistent - requested round state is closed for further gameplay",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "closeRoundRngStateBody idempotent",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const roundId = v4();
            await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});

            const {body: closeRoundRngStateBody1} = await request(api).post("/api/fairness/closeRoundRngState").send({roundId}).expect(200);
            expect(closeRoundRngStateBody1.success).toEqual(true);

            const {body: closeRoundRngStateBody2} = await request(api).post("/api/fairness/closeRoundRngState").send({roundId}).expect(200);
            expect(closeRoundRngStateBody2.success).toEqual(true);
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateRoundRngCursor successful",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const roundId = v4();
            await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});

            await request(api).post("/api/fairness/closeRoundRngState").send({roundId}).expect(200);

            const {body: updateRoundRngCursorBody} = await request(api).post("/api/fairness/updateRoundRngCursor").send({roundId, cursor: 5}).expect(400);
            expect(updateRoundRngCursorBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Fair RNG state inconsistent - attempting to update cursor on a closed Round RNG State",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateRoundRngCursor can only increase cursor by integer value",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const roundId = v4();
            await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});

            await request(api).post("/api/fairness/updateRoundRngCursor").send({roundId, cursor: 5});

            const {body: updateRoundRngCursorBody} = await request(api).post("/api/fairness/updateRoundRngCursor").send({roundId, cursor: 4}).expect(400);
            expect(updateRoundRngCursorBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Fair RNG state inconsistent - incorrect provably fair cursor returned by the game",
                },
            });

            const {body: roundRngState1} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});
            expect(roundRngState1.cursor).toEqual(5);

            const {body: updateRoundRngCursorBody2} = await request(api).post("/api/fairness/updateRoundRngCursor").send({roundId, cursor: 6.5}).expect(422);
            expect(updateRoundRngCursorBody2).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Incorrect value 'cursor'",
                },
            });

            const {body: roundRngState2} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});
            expect(roundRngState2.cursor).toEqual(5);
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateRoundRngCursor on closed round rng state error",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const roundId = v4();
            await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});

            await request(api).post("/api/fairness/updateRoundRngCursor").send({roundId, cursor: 5});

            const {body: updateRoundRngCursorBody} = await request(api).post("/api/fairness/updateRoundRngCursor").send({roundId, cursor: 4}).expect(400);
            expect(updateRoundRngCursorBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Fair RNG state inconsistent - incorrect provably fair cursor returned by the game",
                },
            });

            const {body: roundRngState1} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});
            expect(roundRngState1.cursor).toEqual(5);

            const {body: updateRoundRngCursorBody2} = await request(api).post("/api/fairness/updateRoundRngCursor").send({roundId, cursor: 6.5}).expect(422);
            expect(updateRoundRngCursorBody2).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Incorrect value 'cursor'",
                },
            });

            const {body: roundRngState2} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId, game});
            expect(roundRngState2.cursor).toEqual(5);
        },
        TESTS_TIMEOUT,
    );

    test(
        "getRoundRngState for a new roundId increases nonce by 1",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const roundId1 = v4();
            const {body: getRoundRngStateBody1} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId: roundId1, game});
            expect(getRoundRngStateBody1).toEqual({
                clientSeed: expect.any(String),
                serverSeed: expect.any(String),
                nonce: 0,
                cursor: 0,
            });

            const roundId2 = v4();
            const {body: getRoundRngStateBody2} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId: roundId2, game});
            expect(getRoundRngStateBody2).toEqual({
                clientSeed: getRoundRngStateBody1.clientSeed,
                serverSeed: getRoundRngStateBody1.serverSeed,
                nonce: 1,
                cursor: 0,
            });

            const {body: getRoundRngStateBody3} = await request(api).post("/api/fairness/getRoundRngState").send({playerId: player.playerId, roundId: roundId1, game});
            expect(getRoundRngStateBody3).toEqual(getRoundRngStateBody1);
        },
        TESTS_TIMEOUT,
    );

    test(
        "unhashSeeds successful",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const {body: activeRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"});

            await request(api).post("/fairness/updateClientSeed").send({clientSeed: "new-test-seed"}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);

            const {body: unhashServerSeedBody} = await request(api).get("/fairness/unhashServerSeed").query({serverSeedHash: activeRngSeedsBody.serverSeedHash}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(200);

            expect(activeRngSeedsBody.serverSeedHash).toEqual(generateSeedHash(unhashServerSeedBody.serverSeed));
        },
        TESTS_TIMEOUT,
    );

    test(
        "unhashSeeds active seeds error",
        async () => {
            const player = createPlayer();

            await request(api).post("/api/fairness/initPlayerSeeds").send({playerId: player.playerId}).expect(200);

            const {body: activeRngSeedsBody} = await request(api).get("/fairness/activeRngSeeds").send().auth(auth.sign(player, "player"), {type: "bearer"});

            const {body: unhashServerSeedBody} = await request(api).get("/fairness/unhashServerSeed").query({serverSeedHash: activeRngSeedsBody.serverSeedHash}).auth(auth.sign(player, "player"), {type: "bearer"}).expect(400);
            expect(unhashServerSeedBody).toEqual({
                error: {
                    code: "SERVER_SEED_NOT_REVEALED",
                    message: "Server seed not revealed",
                },
            });
        },
        TESTS_TIMEOUT,
    );
});
