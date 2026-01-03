import {afterAll, beforeAll, describe, jest, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
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

jest.mock("../util/routes", () => {
    const original: any = jest.requireActual("../util/routes");
    return {...original, startCheckingCampaigns: jest.fn()};
});

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
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
