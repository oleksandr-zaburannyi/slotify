import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Wallet} from "../db/model/Wallet";
import fetch, {Response} from "@slotify/shared/lib/fetch";
import * as crypto from "crypto";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {Player} from "../db/model/Player";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {Game} from "../db/model/Game";
import {RoundVerificationCache} from "../db/model/RoundVerificationCache";
import {cleanupAfterTests} from "./cleanup";

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    process.env.IS_PRODUCTION = "false";
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    const config = {url: "https://wallet.com", secretKey: "secret-key"};
    await Wallet.create({id: "standard-wallet", adapter: "standard", config}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await Game.create({game: "test-game2", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.insert({currency: "eur", rate: 1, date: new Date()});
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({initMail: jest.fn, sendMail: () => Promise.resolve()}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

const mockWalletResponse = (response: any): void => {
    mockedFetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify(response)) as Response));
};

afterEach(async () => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();
    await Wallet.query(`UPDATE ${Wallet.getRepository().metadata.tableName} SET enabled = true`);
    await Player.query(`UPDATE ${Player.getRepository().metadata.tableName} SET blocked = false`);
    await RoundVerificationCache.clear();
});

const header = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

const authenticate = async (nativeId: string, game: string = "test-game") => {
    mockWalletResponse({nativeId, token: "sample-token", balance: 789.01, currency: "eur"});
    const params = {wallet: "standard-wallet", operator: "test-operator", key: "test-key", provider: "test-provider", game};
    const {playerId} = (await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200)).body;
    return playerId;
};

describe("validate", () => {
    test("same round from different players", async () => {
        const playerId1 = await authenticate("native-id-1");
        const playerId2 = await authenticate("native-id-2");

        //withdraw
        mockWalletResponse({balance: 100});
        const params = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw", roundId: "round-id", playerId: playerId1, repeat: 1, category: "normal"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({balance: 100});

        //deposit
        mockWalletResponse({balance: 100});
        const params1 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit", roundId: "round-id", playerId: playerId1, repeat: 1, category: "normal"};
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(res1.body).toEqual({balance: 100});

        //deposit
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit2", roundId: "round-id", playerId: playerId2, repeat: 1, category: "normal"};
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);
        expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Round has already transactions from another player"}});
    });

    test("round already finished", async () => {
        const playerId = await authenticate("native-id-1");

        //withdraw
        mockWalletResponse({balance: 100});
        const params = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw-finished", roundId: "round-id2", playerId, repeat: 1, category: "normal"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({balance: 100});

        //deposit
        mockWalletResponse({balance: 100});
        const params1 = {
            amount: 100.01,
            type: "deposit",
            provider: "test-provider",
            game: "test-game",
            rgsTransactionId: "rgs-transaction-id-deposit-finished",
            roundId: "round-id2",
            playerId,
            repeat: 1,
            category: "normal",
            roundFinished: true,
        };
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(res1.body).toEqual({balance: 100});

        //deposit
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-finished2", roundId: "round-id2", playerId, repeat: 1, category: "normal"};
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);
        expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Round already finished"}});
    });

    test("same round different games", async () => {
        const playerId = await authenticate("native-id-1");
        await authenticate("native-id-1", "test-game2");

        //withdraw
        mockWalletResponse({balance: 100});
        const params = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw-game", roundId: "round-id3", playerId, repeat: 1, category: "normal"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({balance: 100});

        //withdraw2
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game2", rgsTransactionId: "rgs-transaction-id-withdraw-game2", roundId: "round-id4", playerId, repeat: 1, category: "normal"};
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);
        expect(res2.body).toEqual({balance: 100});

        //deposit
        mockWalletResponse({balance: 100});
        const params1 = {
            amount: 100.01,
            type: "deposit",
            provider: "test-provider",
            game: "test-game2",
            rgsTransactionId: "rgs-transaction-id-deposit-game",
            roundId: "round-id3",
            playerId,
            repeat: 1,
            category: "normal",
            roundFinished: true,
        };
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(400);
        expect(res1.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Round has already transactions from another game"}});
    });

    test("too many withdrawals", async () => {
        const playerId = await authenticate("native-id-1");

        //withdraw
        mockWalletResponse({balance: 100});
        const params = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw-max-withdraw1", roundId: "round-id5", playerId, repeat: 1, category: "normal"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({balance: 100});

        //withdraw
        mockWalletResponse({balance: 100});
        const params1 = {
            amount: 100.01,
            type: "withdraw",
            provider: "test-provider",
            game: "test-game",
            rgsTransactionId: "rgs-transaction-id-deposit-max-withdraw2",
            roundId: "round-id5",
            playerId,
            repeat: 1,
            category: "normal",
            roundFinished: true,
        };
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(400);
        expect(res1.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Exceeded number of withdrawals"}});
    });

    test("too many deposits", async () => {
        const playerId = await authenticate("native-id-1");

        //withdraw
        mockWalletResponse({balance: 100});
        const params = {amount: 100.01, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw-max-deposit1", roundId: "round-id6", playerId, repeat: 1, category: "normal"};
        const res = await request(api).put("/rgs/test-rgs/transaction").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({balance: 100});

        //deposit
        mockWalletResponse({balance: 100});
        const params1 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-max-deposit2", roundId: "round-id6", playerId, repeat: 1, category: "normal"};
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(res1.body).toEqual({balance: 100});

        //deposit
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-max-deposit3", roundId: "round-id6", playerId, repeat: 1, category: "normal"};
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);
        expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Exceeded number of deposits"}});
    });

    test("deposit without withdrawal", async () => {
        const playerId = await authenticate("native-id-1");

        //deposit
        mockWalletResponse({balance: 100});
        const params2 = {amount: 100.01, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-no-withdrawal", roundId: "round-id7", playerId, repeat: 1, category: "normal"};
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);
        expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "There is no corresponding withdraw"}});
    });

    test("negative withdrawal", async () => {
        const playerId = await authenticate("native-id-1");

        //withdrawal
        mockWalletResponse({balance: 100});
        const params2 = {amount: -1, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-nagative", roundId: "round-id7", playerId, repeat: 1, category: "normal"};
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);
        expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Transaction amount must be greater or equal than zero"}});
    });

    // test("consecutive wins", async () => {
    //     const playerId = await authenticate("native-id-1");
    //
    //     const max = 15;
    //     for (let i = 0; i < max; i++) {
    //         const roundId = "round-id-c" + i;
    //         //withdrawal
    //         mockWalletResponse({balance: 100});
    //         const params1 = {amount: 1, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw-consecutive" + i, roundId, playerId, repeat: 1, category: "normal"};
    //         const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
    //         expect(res1.body).toEqual({balance: 100});
    //
    //         const last = i === max - 1;
    //         mockWalletResponse({balance: 100});
    //         const params2 = {amount: 2, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-deposit-consecutive" + i, roundId, playerId, repeat: 1, category: "normal", roundFinished: true};
    //         const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(last ? 400 : 200);
    //
    //         if (last) {
    //             expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Too many consecutive wins"}});
    //         } else {
    //             expect(res2.body).toEqual({balance: 100});
    //         }
    //     }
    //
    //     //withdrawal
    //     mockWalletResponse({balance: 100});
    //     const params1 = {amount: 1, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-transaction-id-withdraw-consecutive-blocked", roundId: "roundId-c-blocked", playerId, repeat: 1, category: "normal"};
    //     const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(400);
    //     expect(res1.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Wallet 'standard-wallet' is not enabled"}});
    // });
    //
    // test("gw buckets", async () => {
    //     const playerId = await authenticate("native-id-1");
    //
    //     const max = 5;
    //     const dateNow = Date.now;
    //     const bucketInterval = 10 * 60 * 1000;//10 minutes
    //     for (let i = 0; i < max; i++) {
    //         Date.now = jest.fn(() => new Date(dateNow() + bucketInterval * i).valueOf());
    //         const roundId = "round-id-bucket" + i;
    //         //withdrawal
    //         mockWalletResponse({balance: 100});
    //         const params1 = {amount: 1, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-t-id-withdraw-bucket" + i, roundId, playerId, repeat: 1, category: "normal"};
    //         const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
    //         expect(res1.body).toEqual({balance: 100});
    //
    //         const last = i === max - 1;
    //         mockWalletResponse({balance: 100});
    //         const params2 = {amount: 20001, type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-t-id-deposit-bucket" + i, roundId, playerId, repeat: 1, category: "normal", roundFinished: true};
    //         const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(last ? 400 : 200);
    //
    //         if (last) {
    //             expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "GW in buckets too low"}});
    //         } else {
    //             expect(res2.body).toEqual({balance: 100});
    //         }
    //     }
    //
    //     //withdrawal
    //     mockWalletResponse({balance: 100});
    //     const params1 = {amount: 1, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-t-id-withdraw-bucket-blocked", roundId: "roundId-bucket-blocked", playerId, repeat: 1, category: "normal"};
    //     const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(400);
    //     expect(res1.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Wallet 'standard-wallet' is not enabled"}});
    //     Date.now = dateNow;
    // });
    //
    // test("sum gw buckets", async () => {
    //     const playerId = await authenticate("native-id-1");
    //
    //     const max = 3;
    //     const dateNow = Date.now;
    //     const bucketInterval = 10 * 60 * 1000;//10 minutes
    //     const amounts = [10, 10, 100000];
    //     for (let i = 0; i < max; i++) {
    //         Date.now = jest.fn(() => new Date(dateNow() + bucketInterval * i).valueOf());
    //         const roundId = "round-id-bucket_sum" + i;
    //         //withdrawal
    //         mockWalletResponse({balance: 100});
    //         const params1 = {amount: 1, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-t-id-withdraw-bucket_sum" + i, roundId, playerId, repeat: 1, category: "normal"};
    //         const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
    //         expect(res1.body).toEqual({balance: 100});
    //
    //         const last = i === max - 1;
    //         mockWalletResponse({balance: 100});
    //         const params2 = {amount: amounts[i], type: "deposit", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-t-id-deposit-bucket_sum" + i, roundId, playerId, repeat: 1, category: "normal", roundFinished: true};
    //         const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(last ? 400 : 200);
    //
    //         if (last) {
    //             expect(res2.body).toEqual({error: {code: "TRANSACTION_REJECTED", message: "Sum of GW in buckets too low"}});
    //         } else {
    //             expect(res2.body).toEqual({balance: 100});
    //         }
    //     }
    //
    //     //withdrawal
    //     mockWalletResponse({balance: 100});
    //     const params1 = {amount: 1, type: "withdraw", provider: "test-provider", game: "test-game", rgsTransactionId: "rgs-t-id-withdraw-bucket-sum-blocked", roundId: "roundId-bucket-sum-blocked", playerId, repeat: 1, category: "normal"};
    //     const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(400);
    //     expect(res1.body).toEqual({error: {code: "APPLICATION_ERROR", message: "Wallet 'standard-wallet' is not enabled"}});
    //     Date.now = dateNow;
    // });
});
