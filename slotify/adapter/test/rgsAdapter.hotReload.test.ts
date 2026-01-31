import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {Rgs} from "../db/model/Rgs";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {cleanupAfterTests} from "./cleanup";
import {redis} from "@slotify/shared/lib/redis";

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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("rgs hot-reload", () => {
    test("existing RGS is accessible via dynamic dispatch", async () => {
        // The test-rgs should be loaded at startup
        const res = await request(api).get("/rgs/test-rgs/test-endpoint");
        // We don't care about the actual response, just that it's not RGS_NOT_FOUND
        expect(res.body.error?.code).not.toBe("RGS_NOT_FOUND");
    });

    test("non-existent RGS returns RGS_NOT_FOUND", async () => {
        const res = await request(api).get("/rgs/non-existent-rgs/test-endpoint");
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("RGS_NOT_FOUND");
    });

    test("new RGS becomes available after reload", async () => {
        // First verify RGS doesn't exist
        let res = await request(api).get("/rgs/hot-reload-test-rgs/test");
        expect(res.body.error?.code).toBe("RGS_NOT_FOUND");

        // Add RGS to database
        await Rgs.create({
            id: "hot-reload-test-rgs",
            adapter: "standard",
            config: {secretKey: "test"},
        }).save();

        // Trigger invalidation event
        await redis.publish("invalidate/rgss", "");

        // Wait for reload to complete
        await wait(100);

        // Now RGS should be available (not RGS_NOT_FOUND)
        res = await request(api).get("/rgs/hot-reload-test-rgs/test");
        expect(res.body.error?.code).not.toBe("RGS_NOT_FOUND");

        // Cleanup
        await Rgs.delete({id: "hot-reload-test-rgs"});
    });

    test("deleted RGS returns RGS_NOT_FOUND after reload", async () => {
        // Create an RGS
        await Rgs.create({
            id: "hot-reload-delete-rgs",
            adapter: "standard",
            config: {secretKey: "test"},
        }).save();

        // Trigger reload to load it
        await redis.publish("invalidate/rgss", "");
        await wait(100);

        // Verify it's accessible
        let res = await request(api).get("/rgs/hot-reload-delete-rgs/test");
        expect(res.body.error?.code).not.toBe("RGS_NOT_FOUND");

        // Delete from database
        await Rgs.delete({id: "hot-reload-delete-rgs"});

        // Trigger reload
        await redis.publish("invalidate/rgss", "");
        await wait(100);

        // Now should return RGS_NOT_FOUND
        res = await request(api).get("/rgs/hot-reload-delete-rgs/test");
        expect(res.body.error?.code).toBe("RGS_NOT_FOUND");
    });

    test("concurrent requests during RGS reload complete successfully", async () => {
        // Create an RGS
        await Rgs.create({
            id: "hot-reload-concurrent-rgs",
            adapter: "standard",
            config: {secretKey: "test"},
        }).save();

        // Trigger initial reload
        await redis.publish("invalidate/rgss", "");
        await wait(100);

        // Send multiple concurrent requests while triggering a reload
        const requestPromises = [];
        for (let i = 0; i < 10; i++) {
            requestPromises.push(request(api).get("/rgs/hot-reload-concurrent-rgs/test"));
        }

        // Trigger reload mid-requests
        await redis.publish("invalidate/rgss", "");

        // Wait for all requests to complete
        const results = await Promise.all(requestPromises);

        // All requests should complete without RGS_NOT_CONFIGURED error
        for (const res of results) {
            expect(res.body.error?.code).not.toBe("RGS_NOT_CONFIGURED");
        }

        // Cleanup
        await Rgs.delete({id: "hot-reload-concurrent-rgs"});
    });
});
