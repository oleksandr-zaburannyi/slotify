import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
import fetch, {Response} from "@slotify/shared/lib/fetch";
import * as crypto from "crypto";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {Rgs} from "../db/model/Rgs";
import {URLSearchParams} from "url";
import {openboxInterfaceTypeCode, openBoxMethodCodes} from "../walletAdapter/openbox/OpenBoxApiCodes";
import openBoxEncrypt from "../walletAdapter/openbox/openBoxEncrypt";
import {Game} from "../db/model/Game";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";

const rgsConfig = {
    secretKey: "secret-rgs-key",
    realUrl: "https://cdn.test-provider.tech?server=https://test-provider.tech",
};

const rgsHeader = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

const walletConfig = {
    url: "https://vendor-sapi.rtut15.com/api/v1",
    secretKey: "571565e5980d420b98f4c6e36e0b1987",
    vendorUid: "db0d03d3d5e244639f3a4867c5a52976",
};

const TESTS_TIMEOUT = 0;

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Wallet.create({id: "openbox-wallet", adapter: "openbox", config: walletConfig}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    api = await initService();
}, TESTS_TIMEOUT);

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const queueMockWalletResponse = (responseBody: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(responseBody)) as Response));
};

afterEach(() => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();
});

describe("openbox wallet adapter", () => {
    test(
        "decrypt test",
        async () => {
            function openBoxDecrypt(encryptedPayload: string, secretKey: string) {
                const decipher = crypto.createDecipheriv("aes-256-ecb", secretKey, null);

                let decrypted = decipher.update(encryptedPayload, "base64", "utf8");
                decrypted += decipher.final("utf8");

                return decrypted;
            }

            const payload = "example secret message";
            const encryptedPayload = openBoxEncrypt(payload, walletConfig.secretKey);
            expect(openBoxDecrypt(encryptedPayload, walletConfig.secretKey)).toEqual(payload);
        },
        TESTS_TIMEOUT,
    );

    function createLauncherQuery() {
        return {
            "token": "deb399a0c88f476ca2a8eec14b58177b",
            "agency-uid": "4cbd68da3f4a4158a5539cf83597f93e",
            "player-uid": "test-player-native-uid",
            "player-id": "PETER&SONS003",
            "player-type": 1,
            "game-id": "test-game",
            "country": "CN",
            "language": "en",
            "currency": "EUR",
            "channel": "None",
            "backurl": "https://www.openboxgaming.link/game-lobby",
        };
    }

    test(
        "launcher - redirect successful",
        async () => {
            const response = await request(api).get("/wallet/openbox-wallet/launcher").query(createLauncherQuery()).expect(302);

            const [baseUrl, paramsUrl] = response.headers.location.split("?");
            const searchParams = new URLSearchParams(paramsUrl);

            expect(baseUrl).toEqual("https://cdn.test-provider.tech");
            expect(searchParams.get("server")).toEqual("https://test-provider.tech");
            expect(searchParams.get("wallet")).toEqual("openbox-wallet");
            expect(searchParams.get("operator")).toEqual("openbox");
            expect(searchParams.get("provider")).toEqual("test-provider");
            expect(searchParams.get("language")).toEqual("en");
            expect(searchParams.get("lobbyUrl")).toEqual("https://www.openboxgaming.link/game-lobby");
            expect(searchParams.get("key")).toEqual(expect.any(String));
        },
        TESTS_TIMEOUT,
    );

    async function launcherRequest(): Promise<string> {
        const response = await request(api).get("/wallet/openbox-wallet/launcher").query(createLauncherQuery());

        const [, paramsUrl] = response.headers.location.split("?");
        const searchParams = new URLSearchParams(paramsUrl);

        return searchParams.get("key")!;
    }

    function authenticateRequest(key: string, options: {currencyCode?: number} = {}): request.Test {
        // verify player
        const verifyPlayerResponsePayload = {token: "test-permanent-token"};
        queueMockWalletResponse({
            is_success: true,
            error_code: 0,
            error_msg: "",
            timestamp: Date.now(),
            payload: JSON.stringify(verifyPlayerResponsePayload),
        });

        // player information
        const playerInformationResponsePayload = {
            member_account: "test-player-nickname",
            member_uid: "test-player-native-uid",
            currency_code: options.currencyCode !== undefined ? options.currencyCode : 9,
        };
        queueMockWalletResponse({
            is_success: true,
            error_code: 0,
            error_msg: "",
            timestamp: Date.now(),
            payload: JSON.stringify(playerInformationResponsePayload),
        });

        // balance
        const balanceResponsePayload = {balance: 12345};
        queueMockWalletResponse({
            is_success: true,
            error_code: 0,
            error_msg: "",
            timestamp: Date.now(),
            payload: JSON.stringify(balanceResponsePayload),
        });

        const authenticateRequestParams = {
            wallet: "openbox-wallet",
            operator: "test-operator",
            key,
            provider: "test-provider",
            game: "test-game",
        };
        return request(api).post("/rgs/test-rgs/authenticate").send(authenticateRequestParams).set(rgsHeader(authenticateRequestParams));
    }

    test(
        "authenticate - successful",
        async () => {
            const key = await launcherRequest();

            const response = await authenticateRequest(key).expect(200);

            expect(response.body).toEqual({
                nativeId: "test-player-native-uid",
                currency: "eur",
                country: "cn",
                brand: "4cbd68da3f4a4158a5539cf83597f93e",
                nickname: "test-player-nickname",
                balance: 123.45,
                playerId: expect.any(String),
                sessionId: expect.any(String),
            });

            // verify authenticate call
            const [url, requestParams] = mockedFetch.mock.calls[0];
            expect(url).toEqual(walletConfig.url);
            expect(requestParams?.method).toEqual("POST");
            expect(requestParams?.headers).toEqual({
                "Content-Type": "application/json",
                "x-correlation-id": expect.any(String),
                "x-session-id": expect.any(String),
            });
            expect(JSON.parse(requestParams?.body as string)).toEqual({
                method: openBoxMethodCodes.verifyPlayer,
                payload: expect.any(String),
                timestamp: expect.any(Number),
                type: openboxInterfaceTypeCode,
                vendor_uid: walletConfig.vendorUid,
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "authenticate - wrong currency code",
        async () => {
            const key = await launcherRequest();

            const response = await authenticateRequest(key, {currencyCode: 0}).expect(400);

            expect(response.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
        },
        TESTS_TIMEOUT,
    );

    test(
        "transaction - withdraw successful",
        async () => {
            const key = await launcherRequest();

            const authenticateResponse = await authenticateRequest(key);

            const withdrawResponsePayload = {balance: 123.0};
            queueMockWalletResponse({
                is_success: true,
                error_code: 0,
                error_msg: "",
                timestamp: Date.now(),
                payload: JSON.stringify(withdrawResponsePayload),
            });

            const withdrawParams = {
                amount: 0.45,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw",
                roundId: "round-id1",
                playerId: authenticateResponse.body.playerId,
            };
            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);
        },
        TESTS_TIMEOUT,
    );

    test(
        "transaction - withdraw with insufficient funds",
        async () => {
            const key = await launcherRequest();

            const authenticateResponse = await authenticateRequest(key);

            const withdrawResponsePayload = {};
            queueMockWalletResponse({
                is_success: false,
                error_code: 1019,
                error_msg: "VerifyPlayerToken - VerifyPlayerToken Error",
                timestamp: Date.now(),
                payload: JSON.stringify(withdrawResponsePayload),
            });

            const withdrawParams = {
                amount: 123.46,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw-insufficient-funds",
                roundId: "round-id-insufficient-funds",
                playerId: authenticateResponse.body.playerId,
            };
            const response = await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(400);

            expect(response.body).toEqual({
                error: {
                    message: "Application Error",
                    code: "INSUFFICIENT_FUNDS",
                },
            });
        },
        TESTS_TIMEOUT,
    );

    test(
        "cancel - successful",
        async () => {
            const key = await launcherRequest();

            const authenticateResponse = await authenticateRequest(key);

            const withdrawResponsePayload = {balance: 123.0};
            queueMockWalletResponse({
                is_success: true,
                error_code: 0,
                error_msg: "",
                timestamp: Date.now(),
                payload: JSON.stringify(withdrawResponsePayload),
            });

            const withdrawParams = {
                amount: 0.45,
                type: "withdraw",
                provider: "test-provider",
                game: "test-game",
                rgsTransactionId: "rgs-transaction-id-withdraw-cancel-successful",
                roundId: "round-id-cancel-successful",
                playerId: authenticateResponse.body.playerId,
            };
            await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams);

            const cancelResponsePayload = {balance: 12345};
            queueMockWalletResponse({
                is_success: true,
                error_code: 0,
                error_msg: "",
                timestamp: Date.now(),
                payload: JSON.stringify(cancelResponsePayload),
            });

            const cancelParams = {rgsTransactionId: "rgs-transaction-id-withdraw"};
            const cancelResponse = await request(api).delete("/rgs/test-rgs/cancel").set(rgsHeader(cancelParams)).send(cancelParams).expect(200);
            expect(cancelResponse.body).toEqual({balance: 123.45});
        },
        TESTS_TIMEOUT,
    );

    test(
        "balance - successful",
        async () => {
            const key = await launcherRequest();

            const response = await authenticateRequest(key).expect(200);

            const balanceResponsePayload = {balance: 12345};
            queueMockWalletResponse({
                is_success: true,
                error_code: 0,
                error_msg: "",
                timestamp: Date.now(),
                payload: JSON.stringify(balanceResponsePayload),
            });

            const {body} = await request(api)
                .get("/rgs/test-rgs/balance?" + new URLSearchParams({playerId: response.body.playerId, provider: "test-provider", game: "test-game"}))
                .set(rgsHeader({}))
                .expect(200);
            expect(body).toEqual({balance: 123.45});
        },
        TESTS_TIMEOUT,
    );
});
