import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
import fetch, {Response} from "@slotify/shared/lib/fetch";
import * as crypto from "crypto";
import {Player} from "../db/model/Player";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {v4} from "uuid";
import {Game} from "../db/model/Game";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {CurrencyAlias} from "../db/model/CurrencyAlias";
import {Rgs} from "../db/model/Rgs";
import Cipher from "@slotify/shared/lib/Cipher";

const walletConfig = {
    url: "https://qtech.wallet.com",
    secretKey: "secret-key",
    gameLaunchPassKey: "launch-pass-key",
    gameResultPassKey: "result-pass-key",
    currencyAliases: {"USD": "usd-global"},
    currencyAliasesPerBrand: {"USD": {"special-brand": "usd-special"}},
};

const rgsConfig = {
    secretKey: "secret-rgs-key",
    realUrl: "https://cdn.test-provider.tech?server=https://test-provider.tech",
    replayUrl: "https://cdn.test-provider.tech?server=https://test-provider.tech",
};

let api: Express;
let cipher: Cipher;

beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Wallet.create({id: "qtech-wallet", adapter: "qtech", config: walletConfig}).save();
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "usd", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    await CurrencyAlias.create({currency: "usd", alias: "usd-global", multiplier: 1}).save();
    await CurrencyExchange.create({currency: "usd-global", rate: 1, date: new Date()}).save();
    await CurrencyAlias.create({currency: "usd", alias: "usd-special", multiplier: 1}).save();
    await CurrencyExchange.create({currency: "usd-special", rate: 1, date: new Date()}).save();
    cipher = new Cipher(walletConfig.secretKey, "qtech-wallet");
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

const mockWalletResponse = (response: any): void => {
    mockedFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(response)) as Response));
};

const queueMockWalletResponse = (response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(response)) as Response));
};

afterEach(() => {
    mockedFetch.mockReset();
});

const rgsHeader = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

const createKey = (data: any) => {
    return cipher.encrypt(JSON.stringify({...data, timestamp: Date.now()}));
};

describe("qtech wallet adapter - currency aliases", () => {
    test("authenticate with currencyAliasesPerBrand - brand matches", async () => {
        const key = createKey({
            nativeId: "native-1",
            currency: "usd-special",
            brand: "special-brand",
            token: "session-token",
        });

        mockWalletResponse({playerId: "native-1", balance: 100, currency: "USD"});

        const params = {wallet: "qtech-wallet", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(params)).send(params).expect(200);

        expect(res.body.currency).toEqual("usd-special");
        expect(res.body.balance).toEqual(100);

        const player = await Player.findOneBy({nativeId: "native-1", wallet: "qtech-wallet"});
        expect(player?.currency).toEqual("usd-special");
    });

    test("authenticate with currencyAliases fallback - brand not in currencyAliasesPerBrand", async () => {
        const key = createKey({
            nativeId: "native-2",
            currency: "usd-global",
            brand: "other-brand",
            token: "session-token-2",
        });

        mockWalletResponse({playerId: "native-2", balance: 200, currency: "USD"});

        const params = {wallet: "qtech-wallet", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(params)).send(params).expect(200);

        expect(res.body.currency).toEqual("usd-global");
        expect(res.body.balance).toEqual(200);

        const player = await Player.findOneBy({nativeId: "native-2", wallet: "qtech-wallet"});
        expect(player?.currency).toEqual("usd-global");
    });

    test("transaction uses toWalletCurrency with currencyAliasesPerBrand priority - withdraw", async () => {
        const roundId = v4();
        const key = createKey({
            nativeId: "native-3",
            currency: "usd-special",
            brand: "special-brand",
            token: "session-token-3",
        });

        mockWalletResponse({playerId: "native-3", balance: 500, currency: "USD"});
        const authParams = {wallet: "qtech-wallet", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const {body: authBody} = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authParams)).send(authParams).expect(200);
        const {playerId} = authBody;

        queueMockWalletResponse({balance: 450});
        const withdrawParams = {amount: 50, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "qtech-txn-withdraw-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

        const [, withdrawRequestParams] = mockedFetch.mock.calls[1];
        const withdrawBody = JSON.parse(withdrawRequestParams!.body!.toString());
        expect(withdrawBody.currency).toEqual("USD");
    });

    test("transaction uses toWalletCurrency with currencyAliasesPerBrand priority - deposit", async () => {
        const roundId = v4();
        const key = createKey({
            nativeId: "native-4",
            currency: "usd-special",
            brand: "special-brand",
            token: "session-token-4",
        });

        mockWalletResponse({playerId: "native-4", balance: 600, currency: "USD"});
        const authParams = {wallet: "qtech-wallet", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const {body: authBody} = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authParams)).send(authParams).expect(200);
        const {playerId} = authBody;

        queueMockWalletResponse({balance: 550});
        const withdrawParams = {amount: 50, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "qtech-txn-withdraw2-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

        queueMockWalletResponse({balance: 650});
        const depositParams = {amount: 100, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "qtech-txn-deposit-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(depositParams)).send(depositParams).expect(200);

        const [, depositRequestParams] = mockedFetch.mock.calls[2];
        const depositBody = JSON.parse(depositRequestParams!.body!.toString());
        expect(depositBody.currency).toEqual("USD");
    });

    test("transaction uses toWalletCurrency with currencyAliases fallback - withdraw and deposit", async () => {
        const roundId = v4();
        const key = createKey({
            nativeId: "native-5",
            currency: "usd-global",
            brand: "fallback-brand",
            token: "session-token-5",
        });

        mockWalletResponse({playerId: "native-5", balance: 700, currency: "USD"});
        const authParams = {wallet: "qtech-wallet", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const {body: authBody} = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authParams)).send(authParams).expect(200);
        const {playerId} = authBody;
        expect(authBody.currency).toEqual("usd-global");

        queueMockWalletResponse({balance: 650});
        const withdrawParams = {amount: 50, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "qtech-txn-fallback-withdraw-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

        const [, withdrawRequestParams] = mockedFetch.mock.calls[1];
        const withdrawBody = JSON.parse(withdrawRequestParams!.body!.toString());
        expect(withdrawBody.currency).toEqual("USD");

        queueMockWalletResponse({balance: 750});
        const depositParams = {amount: 100, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "qtech-txn-fallback-deposit-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(depositParams)).send(depositParams).expect(200);

        const [, depositRequestParams] = mockedFetch.mock.calls[2];
        const depositBody = JSON.parse(depositRequestParams!.body!.toString());
        expect(depositBody.currency).toEqual("USD");
    });

    test("cancel uses toWalletCurrency with currencyAliasesPerBrand priority", async () => {
        const roundId = v4();
        const key = createKey({
            nativeId: "native-cancel-1",
            currency: "usd-special",
            brand: "special-brand",
            token: "session-token-cancel-1",
        });

        mockWalletResponse({playerId: "native-cancel-1", balance: 500, currency: "USD"});
        const authParams = {wallet: "qtech-wallet", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const {body: authBody} = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authParams)).send(authParams).expect(200);
        const {playerId} = authBody;

        const rgsTransactionId = "qtech-txn-cancel-brand-" + v4();
        queueMockWalletResponse({balance: 450});
        const withdrawParams = {amount: 50, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId, roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

        queueMockWalletResponse({balance: 500});
        const cancelParams = {rgsTransactionId};
        await request(api).delete("/rgs/test-rgs/cancel").set(rgsHeader(cancelParams)).send(cancelParams).expect(200);

        const [cancelUrl, cancelRequestParams] = mockedFetch.mock.calls[2];
        expect(cancelUrl).toContain("/rollback");
        const cancelBody = JSON.parse(cancelRequestParams!.body!.toString());
        expect(cancelBody.currency).toEqual("USD");
    });

    test("cancel uses toWalletCurrency with currencyAliases fallback", async () => {
        const roundId = v4();
        const key = createKey({
            nativeId: "native-cancel-2",
            currency: "usd-global",
            brand: "other-brand",
            token: "session-token-cancel-2",
        });

        mockWalletResponse({playerId: "native-cancel-2", balance: 600, currency: "USD"});
        const authParams = {wallet: "qtech-wallet", operator: "test-operator", key, provider: "test-provider", game: "test-game"};
        const {body: authBody} = await request(api).post("/rgs/test-rgs/authenticate").set(rgsHeader(authParams)).send(authParams).expect(200);
        const {playerId} = authBody;
        expect(authBody.currency).toEqual("usd-global");

        const rgsTransactionId = "qtech-txn-cancel-fallback-" + v4();
        queueMockWalletResponse({balance: 550});
        const withdrawParams = {amount: 50, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId, roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(rgsHeader(withdrawParams)).send(withdrawParams).expect(200);

        queueMockWalletResponse({balance: 600});
        const cancelParams = {rgsTransactionId};
        await request(api).delete("/rgs/test-rgs/cancel").set(rgsHeader(cancelParams)).send(cancelParams).expect(200);

        const [cancelUrl, cancelRequestParams] = mockedFetch.mock.calls[2];
        expect(cancelUrl).toContain("/rollback");
        const cancelBody = JSON.parse(cancelRequestParams!.body!.toString());
        expect(cancelBody.currency).toEqual("USD");
    });
});
