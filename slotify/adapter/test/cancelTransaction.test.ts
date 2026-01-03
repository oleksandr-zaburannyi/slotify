import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {gql} from "graphql-request";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import * as uuid from "uuid";
import {Transaction} from "../db/model/Transaction";
import {cleanupAfterTests} from "./cleanup";

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

afterEach(async () => {
    await Transaction.clear();
});

describe("cancel transaction", () => {
    test("non existing", async () => {
        const query = gql`
            mutation ($id: ID!) {
                closeTransaction(id: $id)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {id: uuid.v4()}).expect(200);
        expect(res.body.errors[0].message).toEqual("Couldn't find transaction to force cancel");
    });

    test("cancel (status failed)", async () => {
        const {id} = await Transaction.create({type: "withdraw", amount: 10, roundId: "round-id", status: "cancel", game: "game", playerId: uuid.v4(), auto: false}).save();
        const query = gql`
            mutation ($id: ID!) {
                closeTransaction(id: $id)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {id}).expect(200);
        expect(res.body.data.closeTransaction).toEqual(true);
        expect((await Transaction.findOneBy({id}))?.status).toEqual("cancelled");
    });

    test("cancel (status cancel)", async () => {
        const {id} = await Transaction.create({type: "withdraw", amount: 10, roundId: "round-id", status: "cancel", game: "game", playerId: uuid.v4(), auto: false}).save();
        const query = gql`
            mutation ($id: ID!) {
                closeTransaction(id: $id)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {id}).expect(200);
        expect(res.body.data.closeTransaction).toEqual(true);
        expect((await Transaction.findOneBy({id}))?.status).toEqual("cancelled");
    });

    test("cancel (status finished)", async () => {
        const {id} = await Transaction.create({type: "withdraw", amount: 10, roundId: "round-id", status: "finished", game: "game", playerId: uuid.v4(), auto: false}).save();
        const query = gql`
            mutation ($id: ID!) {
                closeTransaction(id: $id)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {id}).expect(200);
        expect(res.body.errors[0].message).toEqual("Withdraw transaction needs to be in cancel state");
    });
});
