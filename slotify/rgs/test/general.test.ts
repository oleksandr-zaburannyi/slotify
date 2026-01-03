import {afterAll, beforeAll, describe, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {closeDatabase, closeServer, createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {closeRedis} from "@slotify/shared/lib/redis";
import {stopScheduler} from "@slotify/shared/lib/scheduler";
import {stopIntervals} from "../util/metrics";

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await closeServer();
    await closeDatabase();
    await closeRedis();
    stopScheduler();
    stopIntervals();
});

describe("rgs - general", () => {
    test("health", async () => {
        const {text} = await request(api).get("/health").expect(200);
        expect(text).toEqual("OK");
    });

    test("404", async () => {
        const {body} = await request(api).get("/non-existing-path").expect(404);
        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });
});
