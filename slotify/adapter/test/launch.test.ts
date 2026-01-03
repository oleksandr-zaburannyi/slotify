import * as request from "supertest";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {afterAll, beforeAll, describe, test} from "@jest/globals";
import {Express} from "express";
import {URLSearchParams} from "url";
import {setEnvVariables} from "./setEnvVariables";
import {Rgs} from "../db/model/Rgs";
import {Game} from "../db/model/Game";
import {invalidate} from "@slotify/shared/lib/cache";
import launch from "../route/launch";
import wait from "@slotify/shared/lib/wait";
import {cleanupAfterTests} from "./cleanup";

let api: Express;

beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
});
afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));

describe("launch", () => {
    test("replay", async () => {
        const params: Record<string, string> = {provider: "test-provider", game: "test-game", test: "123", roundId: "be327c92-be90-4106-a061-90498b007666"};
        const redirectUrl = "https://cdn-127.0.0.1/test-provider/test-game/index.html?game=test-game&server=https%3A%2F%2F127.0.0.1&roundId=be327c92-be90-4106-a061-90498b007666&test=123&rgs=test-rgs";
        const redirectUrlWithMobileChannel = "https://cdn-127.0.0.1/test-provider/test-game/index.html?game=test-game&server=https%3A%2F%2F127.0.0.1&roundId=be327c92-be90-4106-a061-90498b007666&test=123&channel=mobile&rgs=test-rgs";
        const androidUserAgent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";
        await request(api)
            .get(`/launch/replay?${new URLSearchParams(params)}`)
            .expect(302)
            .expect("Location", redirectUrl);
        await request(api)
            .get(`/launch/replay?${new URLSearchParams(params)}`)
            .set("user-agent", androidUserAgent)
            .expect(302)
            .expect("Location", redirectUrlWithMobileChannel);
        await request(api).post("/launch/replay").send(params).expect(302).expect("Location", redirectUrl);
        await request(api).post("/launch/replay").set("user-agent", androidUserAgent).send(params).expect(302).expect("Location", redirectUrlWithMobileChannel);
    });

    test("fun", async () => {
        const params: Record<string, string> = {
            mode: "fun",
            provider: "test-provider",
            game: "test-game",
            operator: "test-operator",
            wallet: "test-wallet",
            key: "test-key",
            currency: "sek",
            language: "sv",
            depositUrl: "deposit",
            lobbyUrl: "lobby",
            test: "123",
        };
        const redirectUrl = `https://cdn-127.0.0.1/test-provider/test-game/index.html?game=test-game&server=https%3A%2F%2F127.0.0.1&wallet=demo&operator=test-operator&mode=fun&key=test-key&currency=sek&language=sv&depositUrl=deposit&lobbyUrl=lobby&test=123&rgs=test-rgs`;
        const redirectUrlWithMobileChannel = `https://cdn-127.0.0.1/test-provider/test-game/index.html?game=test-game&server=https%3A%2F%2F127.0.0.1&wallet=demo&operator=test-operator&mode=fun&key=test-key&currency=sek&language=sv&depositUrl=deposit&lobbyUrl=lobby&test=123&channel=mobile&rgs=test-rgs`;
        const androidUserAgent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";
        await request(api)
            .get(`/launch/fun?${new URLSearchParams(params)}`)
            .expect(302)
            .expect("Location", redirectUrl);
        await request(api)
            .get(`/launch/fun?${new URLSearchParams(params)}`)
            .set("user-agent", androidUserAgent)
            .expect(302)
            .expect("Location", redirectUrlWithMobileChannel);
        await request(api).post(`/launch/fun`).send(params).expect(302).expect("Location", redirectUrl);
        await request(api).post(`/launch/fun`).set("user-agent", androidUserAgent).send(params).expect(302).expect("Location", redirectUrlWithMobileChannel);
    });

    test("real", async () => {
        const params: Record<string, string> = {
            mode: "real",
            provider: "test-provider",
            game: "test-game",
            operator: "test-operator",
            wallet: "test-wallet",
            key: "test-key",
            currency: "sek",
            language: "sv",
            depositUrl: "deposit",
            lobbyUrl: "lobby",
            test: "123",
        };
        const redirectUrl = `https://cdn-127.0.0.1/test-provider/test-game/index.html?game=test-game&server=https%3A%2F%2F127.0.0.1&wallet=test-wallet&operator=test-operator&key=test-key&mode=real&currency=sek&language=sv&depositUrl=deposit&lobbyUrl=lobby&test=123&rgs=test-rgs`;
        const redirectUrlWithMobileChannel = `https://cdn-127.0.0.1/test-provider/test-game/index.html?game=test-game&server=https%3A%2F%2F127.0.0.1&wallet=test-wallet&operator=test-operator&key=test-key&mode=real&currency=sek&language=sv&depositUrl=deposit&lobbyUrl=lobby&test=123&channel=mobile&rgs=test-rgs`;
        const androidUserAgent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";
        await request(api)
            .get(`/launch/real?${new URLSearchParams(params)}`)
            .expect(302)
            .expect("Location", redirectUrl);
        await request(api)
            .get(`/launch/real?${new URLSearchParams(params)}`)
            .set("user-agent", androidUserAgent)
            .expect(302)
            .expect("Location", redirectUrlWithMobileChannel);
        await request(api).post(`/launch/real`).send(params).expect(302).expect("Location", redirectUrl);
        await request(api).post(`/launch/real`).set("user-agent", androidUserAgent).send(params).expect(302).expect("Location", redirectUrlWithMobileChannel);
    });

    test("hostname substitution", async () => {
        const hostnameRgsConfig = {
            secretKey: "secret-rgs-key",
            realUrl: "https://cdn-${hostname}?game=${game}&server=https://${hostname}&wallet=${wallet}&operator=${operator}&key=${key}",
            replayUrl: "https://cdn-${hostname}?game=${game}&server=https://${hostname}&roundId=${roundId}",
        };

        process.env.URL = "https://original.hostname.com";

        await Rgs.create({id: "hostname-test-rgs", adapter: "standard", config: hostnameRgsConfig}).save();
        await Game.create({game: "hostname-test-game", provider: "test-provider", rgs: "hostname-test-rgs"}).save();
        invalidate("rgss");
        invalidate("games");
        await wait(10);

        const replayUrl = await launch("replay", {
            roundId: "hostname-round-id",
            operator: "test-operator",
            game: "hostname-test-game",
        });
        expect(replayUrl).toEqual("https://cdn-original.hostname.com?game=hostname-test-game&server=https%3A%2F%2Foriginal.hostname.com&roundId=hostname-round-id&operator=test-operator&rgs=hostname-test-rgs&provider=test-provider");

        const params: Record<string, string> = {
            provider: "test-provider",
            game: "hostname-test-game",
            operator: "test-operator",
            wallet: "test-wallet",
            key: "test-key",
        };

        await request(api)
            .get(`/launch/real?${new URLSearchParams(params)}`)
            .set("Host", "example.hostname.com")
            .expect(302)
            .expect("Location", "https://cdn-example.hostname.com?game=hostname-test-game&server=https%3A%2F%2Fexample.hostname.com&wallet=test-wallet&operator=test-operator&key=test-key&provider=test-provider&rgs=hostname-test-rgs");
    });
});
