import {setEnvVariables} from "./setEnvVariables";
import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {closeDatabase, closeServer, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {v4} from "uuid";
import {generateSeedHash} from "../fairness/generateSeed";
import wait from "@slotify/shared/lib/wait";
import {gql} from "graphql-request";
import {closeRedis} from "@slotify/shared/lib/redis";

setEnvVariables();

let api: Express;
jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("../verify", () => ({
    verify: jest.requireActual("../verify").verify,
    setPeriodicVerification: jest.fn,
    setBackgroundCycling: jest.fn,
}));

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

describe("fairness multiplayer", () => {
    test(
        "generateHashChain - successful",
        async () => {
            const chainLength = 10;
            const roomId = v4();
            const {body} = await request(api)
                .post("/api/fairness/generateHashChain")
                .send({
                    chainLength,
                    roomId,
                })
                .expect(200);
            expect(body).toEqual({success: true});
        },
        TESTS_TIMEOUT,
    );

    test(
        "generateHashChain - missing parameters",
        async () => {
            const chainLength = 10;
            const roomId = v4();
            const {body: generateHashChainBody0} = await request(api).post("/api/fairness/generateHashChain").send({roomId}).expect(422);
            expect(generateHashChainBody0).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Incorrect value 'chainLength'",
                },
            });

            const {body: generateHashChainBody1} = await request(api).post("/api/fairness/generateHashChain").send({chainLength}).expect(422);
            expect(generateHashChainBody1).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Incorrect value 'roomId'",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "generateHashChain - incorrect chain length",
        async () => {
            const chainLength = 1;
            const roomId = v4();

            const {body: generateHashChainBody0} = await request(api).post("/api/fairness/generateHashChain").send({chainLength, roomId}).expect(400);
            expect(generateHashChainBody0).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Incorrect chain length",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "generateHashChain - existing room chain",
        async () => {
            const chainLength = 10;
            const roomId = v4();

            await request(api).post("/api/fairness/generateHashChain").send({chainLength, roomId}).expect(200);

            const {body: generateHashChainBody1} = await request(api).post("/api/fairness/generateHashChain").send({chainLength, roomId}).expect(400);
            expect(generateHashChainBody1).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "RoomRngSeed for a given roomId already exists",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    async function startHashChainGeneration(overrides: {chainLength?: number} = {}) {
        const chainLength = overrides.chainLength || 10;
        const roomId = v4();
        const {body: generateHashChainBody} = await request(api).post("/api/fairness/generateHashChain").send({
            chainLength,
            roomId,
        });
        const {lastHash} = generateHashChainBody;
        return {roomId, chainLength, lastHash};
    }

    test(
        "lastRngHash - successful",
        async () => {
            const {roomId} = await startHashChainGeneration();

            await wait(500);

            const query = gql`
                query ($roomId: ID!) {
                    lastRngHash(roomId: $roomId)
                }
            `;

            const gqlResponse = await graphQlRequest(api, "", query, {roomId}, {}).expect(200);
            expect(gqlResponse.body.data.lastRngHash).toEqual(expect.any(String));
        },
        TESTS_TIMEOUT,
    );

    test(
        "lastRngHash - chain not generated yet",
        async () => {
            const {roomId} = await startHashChainGeneration({chainLength: 1000});

            const query = gql`
                query ($roomId: ID!) {
                    lastRngHash(roomId: $roomId)
                }
            `;

            const gqlResponse = await graphQlRequest(api, "", query, {roomId}, {}).expect(200);
            expect(gqlResponse.body.errors[0].message).toEqual("Hash chain for a given room is not yet generated");
        },
        TESTS_TIMEOUT,
    );

    async function generateHashChain() {
        const {roomId, chainLength} = await startHashChainGeneration();
        await wait(500);

        const query = gql`
            query ($roomId: ID!) {
                lastRngHash(roomId: $roomId)
            }
        `;
        const gqlResponse = await graphQlRequest(api, "", query, {roomId}, {}).expect(200);
        const lastHash = gqlResponse.body.data.lastRngHash;

        return {roomId, chainLength, lastHash};
    }

    test(
        "setRngSeed - successful",
        async () => {
            const {roomId, chainLength, lastHash} = await generateHashChain();

            const seed = "players-seed";
            const {body: setRngSeedBody} = await request(api)
                .post("/api/fairness/setRngSeed")
                .send({
                    roomId,
                    seed,
                })
                .expect(200);
            expect(setRngSeedBody).toEqual({
                chainLength,
                lastHash,
                seed,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "setRngSeed - no hash chain",
        async () => {
            const seed = "players-seed";
            const {body: setRngSeedBody} = await request(api)
                .post("/api/fairness/setRngSeed")
                .send({
                    roomId: v4(),
                    seed,
                })
                .expect(404);
            expect(setRngSeedBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "RoomRngSeed for a given room doesn't exist",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "setRngSeed - hash chain not generated yet",
        async () => {
            const {roomId} = await startHashChainGeneration({chainLength: 1000});

            const seed = "players-seed";
            const {body: setRngSeedBody} = await request(api)
                .post("/api/fairness/setRngSeed")
                .send({
                    roomId,
                    seed,
                })
                .expect(404);
            expect(setRngSeedBody).toEqual({
                error: {
                    code: "CHAIN_NOT_GENERATED",
                    message: "Hash chain for a given room is not yet generated",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "setRngSeed - no seed argument",
        async () => {
            const {roomId} = await generateHashChain();
            const {body: setRngSeedBody} = await request(api).post("/api/fairness/setRngSeed").send({roomId}).expect(422);
            expect(setRngSeedBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Incorrect value 'seed'",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    async function initializeProvableFairness() {
        const {roomId, chainLength, lastHash} = await generateHashChain();

        const seed = "players-seed";
        await request(api).post("/api/fairness/setRngSeed").send({roomId, seed}).expect(200);
        return {roomId, chainLength, lastHash, seed};
    }

    test(
        "setRngSeed - resetting seed error",
        async () => {
            const {roomId} = await initializeProvableFairness();

            await request(api).post("/api/fairness/getDrawRngState").send({roomId, drawId: v4()}).expect(200);

            const {body: setRngSeedBody1} = await request(api)
                .post("/api/fairness/setRngSeed")
                .send({
                    roomId,
                    seed: "updated-players-seed",
                })
                .expect(400);
            expect(setRngSeedBody1).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Seed for a given room is already set",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "getRoundRngState - successful increments hashIndex",
        async () => {
            const {roomId, lastHash} = await initializeProvableFairness();

            const drawId = v4();
            const {body: getDrawRngStateBody0} = await request(api)
                .post("/api/fairness/getDrawRngState")
                .send({
                    roomId,
                    drawId,
                })
                .expect(200);
            expect(getDrawRngStateBody0).toEqual({
                cursor: 0,
                hash: expect.any(String),
                seed: "players-seed",
            });
            expect(generateSeedHash(getDrawRngStateBody0.hash)).toEqual(lastHash);

            // same drawId gives the same hash
            const {body: getDrawRngStateBody1} = await request(api)
                .post("/api/fairness/getDrawRngState")
                .send({
                    roomId,
                    drawId,
                })
                .expect(200);
            expect(getDrawRngStateBody1).toEqual({
                cursor: 0,
                hash: getDrawRngStateBody1.hash,
                seed: "players-seed",
            });

            // new drawId increments hashIndex
            const {body: getDrawRngStateBody2} = await request(api)
                .post("/api/fairness/getDrawRngState")
                .send({
                    roomId,
                    drawId: v4(),
                })
                .expect(200);
            expect(getDrawRngStateBody2).toEqual({
                cursor: 0,
                hash: expect.any(String),
                seed: "players-seed",
            });
            expect(generateSeedHash(getDrawRngStateBody2.hash)).toEqual(getDrawRngStateBody0.hash);

            // cant probe for previous drawId
            const {body: getDrawRngStateBody3} = await request(api)
                .post("/api/fairness/getDrawRngState")
                .send({
                    roomId,
                    drawId,
                })
                .expect(400);
            expect(getDrawRngStateBody3).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Fair RNG state inconsistent - can't get hash that was already consumed",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "getRoundRngState - error when chain is depleted",
        async () => {
            const {roomId, chainLength, lastHash} = await initializeProvableFairness();

            let currentHash = lastHash;
            for (let i = 1; i < chainLength; i++) {
                const {
                    body: {hash},
                } = await request(api)
                    .post("/api/fairness/getDrawRngState")
                    .send({
                        roomId,
                        drawId: v4(),
                    })
                    .expect(200);

                expect(generateSeedHash(hash)).toEqual(currentHash);
                currentHash = hash;
            }

            const drawId = v4();
            const {body: getDrawRngStateBody} = await request(api)
                .post("/api/fairness/getDrawRngState")
                .send({
                    roomId,
                    drawId,
                })
                .expect(400);

            expect(getDrawRngStateBody).toEqual({
                error: {
                    code: "CHAIN_DEPLETED",
                    message: "Hash chain for a given room is depleted",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateRngHashCursor - successful",
        async () => {
            const {roomId} = await initializeProvableFairness();

            const drawId = v4();
            await request(api).post("/api/fairness/getDrawRngState").send({
                roomId,
                drawId,
            });

            const cursor = 13;
            const {body: updateRngHashCursorBody} = await request(api)
                .post("/api/fairness/updateRngHashCursor")
                .send({
                    drawId,
                    cursor,
                })
                .expect(200);
            expect(updateRngHashCursorBody).toEqual({
                cursor,
                hash: expect.any(String),
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateRngHashCursor - cursor lower then before error",
        async () => {
            const {roomId} = await initializeProvableFairness();

            const drawId = v4();
            await request(api).post("/api/fairness/getDrawRngState").send({
                roomId,
                drawId,
            });

            await request(api).post("/api/fairness/updateRngHashCursor").send({
                drawId,
                cursor: 13,
            });

            // same cursor is ok
            await request(api)
                .post("/api/fairness/updateRngHashCursor")
                .send({
                    drawId,
                    cursor: 13,
                })
                .expect(200);

            const {body: updateRngHashCursorBody} = await request(api)
                .post("/api/fairness/updateRngHashCursor")
                .send({
                    drawId,
                    cursor: 7,
                })
                .expect(400);

            expect(updateRngHashCursorBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Fair RNG state inconsistent - requested rng hash cursor update is lower then then current one",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "updateRngHashCursor - update cursor of a previous draw error",
        async () => {
            const {roomId} = await initializeProvableFairness();

            const drawId = v4();
            await request(api).post("/api/fairness/getDrawRngState").send({
                roomId,
                drawId,
            });

            await request(api).post("/api/fairness/getDrawRngState").send({
                roomId,
                drawId: v4(),
            });

            const {body: updateRngHashCursorBody} = await request(api)
                .post("/api/fairness/updateRngHashCursor")
                .send({
                    drawId,
                    cursor: 13,
                })
                .expect(400);

            expect(updateRngHashCursorBody).toEqual({
                error: {
                    code: "APPLICATION_ERROR",
                    message: "Fair RNG state inconsistent - cant update cursor of rng hash that is not active",
                },
            });
        },
        TESTS_TIMEOUT,
    );
});
