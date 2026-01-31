import {setEnvVariables} from "./setEnvVariables";
import {afterAll, beforeAll, describe, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {closeDatabase, closeServer, createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {closeRedis} from "@slotify/shared/lib/redis";

setEnvVariables();

let api: Express;

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("../verify", () => ({verify: jest.requireActual("../verify").verify, setPeriodicVerification: jest.fn}));
jest.mock("../cycle", () => ({cycle: jest.requireActual("../cycle").cycle, setBackgroundCycling: jest.fn}));
jest.mock("../seed", () => ({seed: jest.requireActual("../seed").seed, setPeriodicReseeding: jest.fn}));

beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await closeDatabase();
    await closeServer();
    await closeRedis();
});

describe("api", () => {
    test("numbers", async () => {
        const {body} = await request(api).get("/api/numbers?total=5&provider=test-provider&game=test-game").expect(200);
        expect(body.numbers.length).toEqual(5);

        for (const number of body.numbers) {
            expect(typeof number).toEqual("number");
            expect(number).toBeLessThan(1);
            expect(number).toBeGreaterThanOrEqual(0);
        }
    });
});
