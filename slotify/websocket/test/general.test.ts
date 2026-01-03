import {afterAll, beforeAll, describe, test} from "@jest/globals";
import * as request from "supertest";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {closeServer, initService} from "@slotify/shared/lib/testUtils";
import {closeRedis} from "@slotify/shared/lib/redis";

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("../route/websocketServer", () => {
    const original: any = jest.requireActual("../route/websocketServer");
    return {...original, updateAllConnections: jest.fn()};
});
let api: Express;
beforeAll(async () => {
    setEnvVariables();
    api = await initService();
});

afterAll(async () => {
    await closeServer();
    await closeRedis();
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
