import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
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

describe("wallet hot-reload", () => {
    test("existing wallet is accessible via dynamic dispatch", async () => {
        // The demo wallet should be loaded at startup
        const res = await request(api).get("/wallet/demo/test-endpoint");
        // We don't care about the actual response, just that it's not WALLET_NOT_FOUND
        expect(res.body.error?.code).not.toBe("WALLET_NOT_FOUND");
    });

    test("non-existent wallet returns WALLET_NOT_FOUND", async () => {
        const res = await request(api).get("/wallet/non-existent-wallet/test-endpoint");
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("WALLET_NOT_FOUND");
    });

    test("new wallet becomes available after reload", async () => {
        // First verify wallet doesn't exist
        let res = await request(api).get("/wallet/hot-reload-test-wallet/test");
        expect(res.body.error?.code).toBe("WALLET_NOT_FOUND");

        // Add wallet to database
        await Wallet.create({
            id: "hot-reload-test-wallet",
            adapter: "standard",
            config: {url: "http://test.com", secretKey: "test"},
            enabled: true,
        }).save();

        // Trigger invalidation event
        await redis.publish("invalidate/wallets", "");

        // Wait for reload to complete
        await wait(100);

        // Now wallet should be available (not WALLET_NOT_FOUND)
        res = await request(api).get("/wallet/hot-reload-test-wallet/test");
        expect(res.body.error?.code).not.toBe("WALLET_NOT_FOUND");

        // Cleanup
        await Wallet.delete({id: "hot-reload-test-wallet"});
    });

    test("deleted wallet returns WALLET_NOT_FOUND after reload", async () => {
        // Create a wallet
        await Wallet.create({
            id: "hot-reload-delete-test",
            adapter: "standard",
            config: {url: "http://test.com", secretKey: "test"},
            enabled: true,
        }).save();

        // Trigger reload to load it
        await redis.publish("invalidate/wallets", "");
        await wait(100);

        // Verify it's accessible
        let res = await request(api).get("/wallet/hot-reload-delete-test/test");
        expect(res.body.error?.code).not.toBe("WALLET_NOT_FOUND");

        // Delete from database
        await Wallet.delete({id: "hot-reload-delete-test"});

        // Trigger reload
        await redis.publish("invalidate/wallets", "");
        await wait(100);

        // Now should return WALLET_NOT_FOUND
        res = await request(api).get("/wallet/hot-reload-delete-test/test");
        expect(res.body.error?.code).toBe("WALLET_NOT_FOUND");
    });

    test("disabled wallet is not loaded into memory map", async () => {
        // Create a disabled wallet
        await Wallet.create({
            id: "hot-reload-disabled-test",
            adapter: "standard",
            config: {url: "http://test.com", secretKey: "test"},
            enabled: false,
        }).save();

        // Trigger reload - disabled wallets should not be loaded into memory
        await redis.publish("invalidate/wallets", "");
        await wait(100);

        // Since disabled wallets are not loaded into memory, the request
        // falls through to DB lookup. The response depends on cache timing,
        // but should not be a successful response or WALLET_NOT_CONFIGURED.
        const res = await request(api).get("/wallet/hot-reload-disabled-test/test");
        expect(res.status).toBe(404);
        // The important assertion: should NOT get WALLET_NOT_CONFIGURED
        // (which would indicate it was in the memory map)
        expect(res.body.error?.code).not.toBe("WALLET_NOT_CONFIGURED");

        // Cleanup
        await Wallet.delete({id: "hot-reload-disabled-test"});
    });

    test("concurrent requests during reload complete successfully", async () => {
        // Create a wallet
        await Wallet.create({
            id: "hot-reload-concurrent-test",
            adapter: "standard",
            config: {url: "http://test.com", secretKey: "test"},
            enabled: true,
        }).save();

        // Trigger initial reload
        await redis.publish("invalidate/wallets", "");
        await wait(100);

        // Send multiple concurrent requests while triggering a reload
        const requestPromises = [];
        for (let i = 0; i < 10; i++) {
            requestPromises.push(request(api).get("/wallet/hot-reload-concurrent-test/test"));
        }

        // Trigger reload mid-requests
        await redis.publish("invalidate/wallets", "");

        // Wait for all requests to complete
        const results = await Promise.all(requestPromises);

        // All requests should complete without WALLET_NOT_CONFIGURED error
        // (they may return other errors based on the route, but not NOT_CONFIGURED)
        for (const res of results) {
            expect(res.body.error?.code).not.toBe("WALLET_NOT_CONFIGURED");
        }

        // Cleanup
        await Wallet.delete({id: "hot-reload-concurrent-test"});
    });
});
