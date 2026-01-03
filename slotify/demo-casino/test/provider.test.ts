import * as request from "supertest";
import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import * as crypto from "crypto";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {closeDatabase, closeServer, createTestDatabase, initService} from "@slotify/shared/lib/testUtils";

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await closeServer();
    await closeDatabase();
});

const header = (params: any, key: string = "secret-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

describe("demo-casino", () => {
    test("server unauthorized", async () => {
        const params = {operator: "test-operator", key: "test-key", game: "test-game"};

        const res = await request(api).post("/authenticate").set(header({})).send(params).expect(401);
        expect(res.body).toEqual({error: {code: "SERVER_UNAUTHORIZED", message: "Couldn't authorize the server"}});
    });

    test("authenticate", async () => {
        const params = {operator: "test-operator", key: "test-key", game: "test-game"};

        const res = await request(api).post("/authenticate").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({
            "balance": 10000,
            "brand": "demo",
            "country": "uk",
            "currency": "eur",
            "gender": "m",
            "jurisdiction": "mt",
            "nativeId": "test-key",
            "nickname": null,
            "operator": "test-operator",
            "token": "token_test-key",
        });
    });

    test("authenticate with cheat", async () => {
        const params = {operator: "test-operator", key: "my-native-id:200:sek:se:se2:my-brand:my-nickname", game: "test-game"};

        const res = await request(api).post("/authenticate").set(header(params)).send(params).expect(200);
        expect(res.body).toEqual({
            "balance": 200,
            "brand": "my-brand",
            "country": "se2",
            "currency": "sek",
            "gender": "m",
            "jurisdiction": "se",
            "nativeId": "my-native-id",
            "nickname": "my-nickname",
            "operator": "test-operator",
            "token": "token_my-native-id",
        });
    });

    test("player non_existing_key", async () => {
        const params = {operator: "test-operator", key: "non_existing_key", game: "test-game"};
        const body = (await request(api).post("/authenticate").set(header(params)).send(params).expect(400)).body;

        expect(body).toEqual({error: {code: "PLAYER_UNAUTHORIZED", message: "Incorrect key"}});
    });

    test("player unauthorized", async () => {
        const params = {operator: "test-operator", key: "test-key", game: "test-game"};
        await request(api).post("/authenticate").set(header(params)).send(params).expect(200);

        const {body} = await request(api).post("/balance").set(header({})).set({"authorization": "Bearer abc"}).expect(401);
        expect(body).toEqual({error: {code: "PLAYER_UNAUTHORIZED", message: "Couldn't authorize the player"}});
    });

    test("balance", async () => {
        const params = {operator: "test-operator", key: "test-key", game: "test-game"};
        const {token} = (await request(api).post("/authenticate").set(header(params)).send(params).expect(200)).body;

        const {body} = await request(api)
            .post("/balance")
            .set(header({}))
            .set({"authorization": `Bearer ${token}`})
            .expect(200);
        expect(body).toEqual({balance: 10000});
    });

    test("deposit", async () => {
        const params = {operator: "test-operator", key: "test-key-deposit", game: "test-game"};
        const {token} = (await request(api).post("/authenticate").set(header(params)).send(params).expect(200)).body;

        const params2 = {amount: 100.01, type: "deposit", game: "test-game", transactionId: "transaction-id-deposit", roundId: "round-id"};
        const res = await request(api)
            .put("/transaction")
            .set(header(params2))
            .set({"authorization": `Bearer ${token}`})
            .send(params2)
            .expect(200);
        expect(res.body).toEqual({balance: 10000 + 100.01});
    });

    test("withdrawal", async () => {
        const params = {operator: "test-operator", key: "test-key-withdrawal", game: "test-game"};
        const {token} = (await request(api).post("/authenticate").set(header(params)).send(params).expect(200)).body;

        const params2 = {amount: 200.02, type: "withdraw", game: "test-game", transactionId: "transaction-id-withdrawal", roundId: "round-id"};
        const res = await request(api)
            .put("/transaction")
            .set(header(params2))
            .set({"authorization": `Bearer ${token}`})
            .send(params2)
            .expect(200);
        expect(res.body).toEqual({balance: 10000 - 200.02});
    });

    test("round finished", async () => {
        const params = {operator: "test-operator", key: "test-key-withdrawal", game: "test-game"};
        const {token} = (await request(api).post("/authenticate").set(header(params)).send(params).expect(200)).body;

        const params2 = {amount: 200.02, type: "withdraw", game: "test-game", transactionId: "finished-transaction-id-withdrawal", roundId: "round-id-finished", roundFinished: true};
        await request(api)
            .put("/transaction")
            .set(header(params2))
            .set({"authorization": `Bearer ${token}`})
            .send(params2)
            .expect(200);

        const params3 = {amount: 200.02, type: "withdraw", game: "test-game", transactionId: "finished-transaction-id-withdrawal2", roundId: "round-id-finished"};
        const res = await request(api)
            .put("/transaction")
            .set(header(params3))
            .set({"authorization": `Bearer ${token}`})
            .send(params3)
            .expect(400);

        expect(res.body).toEqual({error: {code: "UNKNOWN", message: "Round was already finished"}});
    });

    test("withdrawal (free bet)", async () => {
        const params = {operator: "test-operator", key: "test-key-free-bet", game: "test-game"};
        const {token} = (await request(api).post("/authenticate").set(header(params)).send(params).expect(200)).body;

        const params2 = {amount: 100.01, type: "withdraw", game: "test-game", transactionId: "transaction-id-free-bet", roundId: "round-id2", campaignType: "freeBets"};
        const res = await request(api)
            .put("/transaction")
            .set(header(params2))
            .set({"authorization": `Bearer ${token}`})
            .send(params2)
            .expect(200);
        expect(res.body).toEqual({balance: 10000});
    });

    test("insufficient funds", async () => {
        const params = {operator: "test-operator", key: "test-key-insufficient-funds", game: "test-game"};
        const {token} = (await request(api).post("/authenticate").set(header(params)).send(params).expect(200)).body;

        const params2 = {amount: 10000.01, type: "withdraw", game: "test-game", transactionId: "transaction-id-insufficient-funds", roundId: "round-id"};
        const res = await request(api)
            .put("/transaction")
            .set(header(params2))
            .set({"authorization": `Bearer ${token}`})
            .send(params2)
            .expect(400);
        expect(res.body).toEqual({error: {code: "INSUFFICIENT_FUNDS", message: "Not enough money to make withdrawal"}});
    });

    test("cancel", async () => {
        const params = {operator: "test-operator", key: "test-key-cancel", game: "test-game"};
        const {token} = (await request(api).post("/authenticate").set(header(params)).send(params).expect(200)).body;

        const params2 = {amount: 100.01, type: "withdraw", game: "test-game", transactionId: "transaction-id-cancel", roundId: "round-id"};
        await request(api)
            .put("/transaction")
            .set(header(params2))
            .set({"authorization": `Bearer ${token}`})
            .send(params2)
            .expect(200);

        const params3 = {transactionId: "transaction-id-cancel"};
        const res2 = await request(api)
            .delete("/cancel")
            .set(header(params3))
            .set({"authorization": `Bearer ${token}`})
            .send(params3)
            .expect(200);
        expect(res2.body).toEqual({balance: 10000});
    });
});
