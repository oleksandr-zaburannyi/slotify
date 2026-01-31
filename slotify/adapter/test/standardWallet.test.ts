import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
import fetch, {Response} from "@slotify/shared/lib/fetch";
import * as crypto from "crypto";
import {Player} from "../db/model/Player";
import {URLSearchParams} from "url";
import {Transaction} from "../db/model/Transaction";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {v4} from "uuid";
import {Game} from "../db/model/Game";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {CurrencyAlias} from "../db/model/CurrencyAlias";

let api: Express;
const aliasConfig = {
    url: "https://wallet.com",
    secretKey: "secret-key",
    currencyAliases: {"EUR": "eur-global"},
    currencyAliasesPerBrand: {"EUR": {"special-brand": "eur-special"}},
};
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    const config = {url: "https://wallet.com", secretKey: "secret-key"};
    await Wallet.create({id: "standard-wallet", adapter: "standard", config}).save();
    await Wallet.create({id: "standard-wallet-alias", adapter: "standard", config: aliasConfig}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    await CurrencyAlias.create({currency: "eur", alias: "eur-global", multiplier: 1}).save();
    await CurrencyExchange.create({currency: "eur-global", rate: 1, date: new Date()}).save();
    await CurrencyAlias.create({currency: "eur", alias: "eur-special", multiplier: 1}).save();
    await CurrencyExchange.create({currency: "eur-special", rate: 1, date: new Date()}).save();
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

afterEach(() => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();
});

const header = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

describe("standard wallet adapter", () => {
    test("no secretKey", async () => {
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").send(params).expect(400);
        expect(res.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });

    test("invalid secretKey", async () => {
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params, "invalid-secret-key")).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });

    test("authenticate", async () => {
        const walletResponse = {nativeId: "native-id", token: "sample-token", balance: 123.45, currency: "sek", country: "sv", brand: "test-brand", nickname: "test-nickname", gender: "f", jurisdiction: "uk"};
        mockWalletResponse(walletResponse);
        const params: any = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};

        //response
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);
        const {token, ...response} = walletResponse;
        expect(res.body).toEqual({...response, playerId: expect.any(String), sessionId: expect.any(String)});

        //request
        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://wallet.com/authenticate");
        expect(requestParams).toEqual({
            method: "POST",
            body: expect.any(String),
            headers: expect.objectContaining({
                "Content-Type": "application/json",
                "X-Server-Authorization": crypto.createHmac("sha256", "secret-key").update(requestParams!.body!.toString()).digest("hex"),
            }),
            timeout: 15000,
        });
        const requestBody = JSON.parse(requestParams!.body!.toString());
        expect(requestBody).toEqual({...params});

        //player in the database
        const player = {
            ...response,
            balance: undefined,
            id: expect.any(String),
            currency: "sek",
            operator: "test-operator",
            wallet: "standard-wallet",
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            blocked: null,
            group: null,
        };
        expect(await Player.findOneBy({nativeId: "native-id", wallet: "standard-wallet"})).toEqual(player);
    });

    test("authenticate - preserve currency", async () => {
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};

        //authenticate 1
        mockWalletResponse({nativeId: "native-id-currency-duplication", token: "sample-token", balance: 789.01, currency: "eur"});
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);
        expect(res.body.currency).toEqual("eur");

        //authenticate 2
        mockWalletResponse({nativeId: "native-id-currency-duplication", token: "sample-token", balance: 789.01, currency: "sek"});
        const res2 = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);
        expect(res2.body).toEqual({error: {message: "Application Error", "code": "APPLICATION_ERROR"}});
    });

    test("balance", async () => {
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;

        //balance
        mockWalletResponse({balance: 123.45});
        const {body} = await request(api)
            .get("/rgs/test-rgs/balance?" + new URLSearchParams({playerId, provider: "test-provider", game: "test-game"}))
            .set(header({}))
            .expect(200);
        expect(body).toEqual({balance: 123.45});
    });

    test("deposit", async () => {
        const roundId = v4();

        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;

        //withdraw
        mockWalletResponse({balance: 100});
        const params1 = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw1", roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);

        //transaction response
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit1", roundId, playerId};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(res.body).toEqual({balance: 100});

        //transaction request
        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://wallet.com/transaction");
        expect(requestParams).toEqual({
            body: expect.any(String),
            method: "PUT",
            timeout: 15000,
            headers: expect.objectContaining({
                "Authorization": "Bearer sample-token",
                "Content-Type": "application/json",
                "X-Server-Authorization": crypto.createHmac("sha256", "secret-key").update(requestParams!.body!.toString()).digest("hex"),
            }),
        });

        expect(JSON.parse(requestParams!.body!.toString())).toEqual({
            game: "test-game",
            nativeId: "native-id",
            provider: "test-provider",
            transactionId: expect.any(String),
            type: "deposit",
            amount: 100.01,
            currency: "sek",
            playerId,
            roundId,
        });
    });

    test("deposit - duplicated rgsTransactionId index", async () => {
        const insert = async () => await Transaction.create({type: "deposit", rgs: "a", rgsTransactionId: "b", roundId: v4(), status: "started", game: "game", playerId: v4(), auto: false, amount: 10}).save();
        await insert();
        await expect(insert()).rejects.toThrow(/duplicate key value violates unique constraint/);
    });

    test("deposit - duplicated rgsTransactionId", async () => {
        const roundId = v4();
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;
        mockedFetch.mockReset();

        //transactions
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-duplicated", roundId, playerId};

        //transaction 1
        expect(mockedFetch.mock.calls.length).toEqual(0);
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(mockedFetch.mock.calls.length).toEqual(1);
        expect(res.body).toEqual({balance: 100});

        //transaction 2
        expect(mockedFetch.mock.calls.length).toEqual(1);
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(mockedFetch.mock.calls.length).toEqual(1);
        expect(res2.body).toEqual({balance: 100});
    });

    test("deposit - duplicated rgsTransactionId, transaction not finished", async () => {
        const roundId = v4();
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;
        mockedFetch.mockReset();

        //transactions
        mockWalletResponse({balance: 100});
        const rgsTransactionId = "rgs-transaction-id-duplicated-not-finished";
        const params2 = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId, roundId, playerId};

        //transaction 1
        expect(mockedFetch.mock.calls.length).toEqual(0);
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(mockedFetch.mock.calls.length).toEqual(1);
        expect(res.body).toEqual({balance: 100});
        await Transaction.update({rgsTransactionId}, {status: "cancel"});

        //transaction 2
        expect(mockedFetch.mock.calls.length).toEqual(1);
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(mockedFetch.mock.calls.length).toEqual(2);
        expect(res2.body).toEqual({balance: 100});
    });

    test("withdrawal", async () => {
        const roundId = v4();
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;

        //transaction response
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "withdraw", game: "test-game", provider: "test-provider", rgsTransactionId: "rgs-transaction-id-2", roundId, playerId};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(res.body).toEqual({balance: 100});

        //transaction request
        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://wallet.com/transaction");
        expect(requestParams).toEqual({
            body: expect.any(String),
            method: "PUT",
            timeout: 15000,
            headers: expect.objectContaining({
                "Authorization": "Bearer sample-token",
                "Content-Type": "application/json",
                "X-Server-Authorization": crypto.createHmac("sha256", "secret-key").update(requestParams!.body!.toString()).digest("hex"),
            }),
        });

        expect(JSON.parse(requestParams!.body!.toString())).toEqual({
            game: "test-game",
            nativeId: "native-id",
            provider: "test-provider",
            transactionId: expect.any(String),
            type: "withdraw",
            amount: 100.01,
            currency: "sek",
            playerId,
            roundId,
        });
    });

    test("withdrawal (disabled wallet)", async () => {
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;

        //transaction response
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "withdraw", game: "test-game", provider: "test-provider", rgsTransactionId: "rgs-transaction-id-3", roundId: "round-id3", playerId};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(res.body).toEqual({balance: 100});

        await Wallet.update({id: "standard-wallet"}, {enabled: false});
        //transaction response
        mockWalletResponse({balance: 100});
        const params3 = {amount: 100.01, type: "withdraw", game: "test-game2", provider: "test-provider", rgsTransactionId: "rgs-transaction-id-disabled-3", roundId: "round-id-disabled", playerId};
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params3)).send(params3).expect(400);
        expect(res2.body).toEqual({error: {code: "GAME_NOT_AVAILABLE", message: "Application Error"}});

        await Wallet.update({id: "standard-wallet"}, {enabled: true});
    });

    test("cancel - non existing transactionId", async () => {
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        //cancel
        const params2 = {provider: "test-provider", rgsTransactionId: "rgs-transaction-id-cancel-non-existing"};
        const res = await request(api).delete("/rgs/test-rgs/cancel").set(header(params2)).send(params2).expect(400);
        expect(res.body).toEqual({error: {code: "TRANSACTION_NOT_FOUND", message: "Application Error"}});
    });

    test("cancel - deposit", async () => {
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;

        //withdraw
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-to-cancel-withdraw", roundId: "round-id6", playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        //deposit
        mockWalletResponse({balance: 100});
        const params3 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-to-cancel", roundId: "round-id6", playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(params3)).send(params3).expect(200);

        //cancel response
        const params4 = {provider: "test-provider", rgsTransactionId: "rgs-transaction-id-deposit-to-cancel"};
        const res = await request(api).delete("/rgs/test-rgs/cancel").set(header(params4)).send(params4).expect(400);
        expect(res.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Application Error"}});
    });

    test("cancel - withdrawal", async () => {
        //authenticate
        mockWalletResponse({nativeId: "native-id", token: "sample-token", balance: 789.01, currency: "sek"});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", rgs: "test-tgs", provider: "test-provider", game: "test-game"};
        const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;
        const roundId = v4();

        //deposit
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgs: "test-rgs", rgsTransactionId: "rgs-transaction-id-withdraw", roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        //cancel response
        mockWalletResponse({balance: 200});
        const params3 = {rgsTransactionId: "rgs-transaction-id-withdraw"};
        const res = await request(api).delete("/rgs/test-rgs/cancel").set(header(params3)).send(params3).expect(200);
        expect(res.body).toEqual({balance: 200});

        //cancel request
        const [url, requestParams] = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
        expect(url).toEqual("https://wallet.com/cancel");
        expect(requestParams).toEqual({
            body: expect.any(String),
            method: "DELETE",
            timeout: 15000,
            headers: expect.objectContaining({
                "Authorization": "Bearer sample-token",
                "Content-Type": "application/json",
                "X-Server-Authorization": crypto.createHmac("sha256", "secret-key").update(requestParams!.body!.toString()).digest("hex"),
            }),
        });

        const transaction = await Transaction.findOneBy({rgs: "test-rgs", rgsTransactionId: "rgs-transaction-id-withdraw"});
        expect(JSON.parse(requestParams!.body!.toString())).toEqual({nativeId: "native-id", playerId, transactionId: transaction!.id, roundId});
    });

    test("returned wallet error", async () => {
        //authenticate
        mockWalletResponse({error: {code: "UNKNOWN"}});
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "UNKNOWN", message: "Application Error"}});
    });

    test("unexpected wallet error", async () => {
        //authenticate
        mockedFetch.mockImplementation(() => {
            throw new Error();
        });
        const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);
        expect(res.body).toEqual({error: {code: "NETWORK_ERROR", message: "Application Error"}});
    });

    test("authenticate with currencyAliasesPerBrand - brand matches", async () => {
        const walletResponse = {nativeId: "native-id-alias-1", token: "sample-token", balance: 100, currency: "EUR", brand: "special-brand"};
        mockWalletResponse(walletResponse);
        const params = {wallet: "standard-wallet-alias", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);
        expect(res.body.currency).toEqual("eur-special");

        const player = await Player.findOneBy({nativeId: "native-id-alias-1", wallet: "standard-wallet-alias"});
        expect(player?.currency).toEqual("eur-special");
    });

    test("authenticate with currencyAliases fallback - brand not in currencyAliasesPerBrand", async () => {
        const walletResponse = {nativeId: "native-id-alias-2", token: "sample-token", balance: 100, currency: "EUR", brand: "other-brand"};
        mockWalletResponse(walletResponse);
        const params = {wallet: "standard-wallet-alias", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const res = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);
        expect(res.body.currency).toEqual("eur-global");

        const player = await Player.findOneBy({nativeId: "native-id-alias-2", wallet: "standard-wallet-alias"});
        expect(player?.currency).toEqual("eur-global");
    });

    test("transaction uses toWalletCurrency with currencyAliasesPerBrand priority", async () => {
        const roundId = v4();

        mockWalletResponse({nativeId: "native-id-alias-3", token: "sample-token", balance: 200, currency: "EUR", brand: "special-brand"});
        const authParams = {wallet: "standard-wallet-alias", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {body: authBody} = await request(api).post("/rgs/test-rgs/authenticate").set(header(authParams)).send(authParams).expect(200);
        const {playerId} = authBody;

        mockWalletResponse({balance: 190});
        const withdrawParams = {amount: 10, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-txn-alias-withdraw-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawParams)).send(withdrawParams).expect(200);

        const [, withdrawRequestParams] = mockedFetch.mock.calls[1];
        const withdrawBody = JSON.parse(withdrawRequestParams!.body!.toString());
        expect(withdrawBody.currency).toEqual("EUR");

        mockWalletResponse({balance: 210});
        const depositParams = {amount: 20, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-txn-alias-deposit-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(depositParams)).send(depositParams).expect(200);

        const [, depositRequestParams] = mockedFetch.mock.calls[2];
        const depositBody = JSON.parse(depositRequestParams!.body!.toString());
        expect(depositBody.currency).toEqual("EUR");
    });

    test("transaction uses toWalletCurrency with currencyAliases fallback", async () => {
        const roundId = v4();

        mockWalletResponse({nativeId: "native-id-alias-4", token: "sample-token", balance: 300, currency: "EUR", brand: "fallback-brand"});
        const authParams = {wallet: "standard-wallet-alias", operator: "test-operator", key: "test-key", provider: "test-provider", game: "test-game"};
        const {body: authBody} = await request(api).post("/rgs/test-rgs/authenticate").set(header(authParams)).send(authParams).expect(200);
        const {playerId} = authBody;
        expect(authBody.currency).toEqual("eur-global");

        mockWalletResponse({balance: 280});
        const withdrawParams = {amount: 20, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-txn-fallback-withdraw-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(withdrawParams)).send(withdrawParams).expect(200);

        const [, withdrawRequestParams] = mockedFetch.mock.calls[1];
        const withdrawBody = JSON.parse(withdrawRequestParams!.body!.toString());
        expect(withdrawBody.currency).toEqual("EUR");

        mockWalletResponse({balance: 330});
        const depositParams = {amount: 50, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-txn-fallback-deposit-" + v4(), roundId, playerId};
        await request(api).put("/rgs/test-rgs/transaction").set(header(depositParams)).send(depositParams).expect(200);

        const [, depositRequestParams] = mockedFetch.mock.calls[2];
        const depositBody = JSON.parse(depositRequestParams!.body!.toString());
        expect(depositBody.currency).toEqual("EUR");
    });
});
