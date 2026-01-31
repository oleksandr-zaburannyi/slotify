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

describe("general", () => {
    test("health", async () => {
        const {text} = await request(api).get("/health").expect(200);
        expect(text).toEqual("OK");
    });

    test("404", async () => {
        const {body} = await request(api).get("/non-existing-path").expect(404);
        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });
});
