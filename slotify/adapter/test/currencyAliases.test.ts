import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {gql} from "graphql-request";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {setEnvVariables} from "./setEnvVariables";
import {Express} from "express";
import {cleanupAfterTests} from "./cleanup";
import {CurrencyExchange} from "../db/model/CurrencyExchange";

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

const getById = async (alias: string) => {
    const query = gql`
        query ($alias: JSON) {
            currencyAliases(filter: [{field: "alias", type: EQUAL, value: $alias}]) {
                items {
                    alias
                    currency
                    multiplier
                }
            }
        }
    `;
    const res = await graphQlRequest(api, await accountToken(api), query, {alias}).expect(200);
    return res.body.data.currencyAliases.items[0];
};

const add = async (alias: string, currency: string, multiplier: number) => {
    const query = gql`
        mutation ($alias: String!, $multiplier: Float!, $currency: String!) {
            addCurrencyAlias(data: {alias: $alias, multiplier: $multiplier, currency: $currency})
        }
    `;
    const res = await graphQlRequest(api, await accountToken(api), query, {alias, currency, multiplier}).expect(200);
    return res.body;
};

describe("currencyAliases", () => {
    test("get", async () => {
        const query = gql`
            query {
                currencyAliases {
                    items {
                        alias
                        currency
                        multiplier
                    }
                }
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query).expect(200);
        expect(res.body.data.currencyAliases.items).toContainEqual({alias: "mbtc", currency: "btc", multiplier: 0.001});
    });

    test("add", async () => {
        await CurrencyExchange.save({currency: "b", rate: 123, date: new Date()});
        expect((await add("a", "b", 10)).data.addCurrencyAlias).toEqual(expect.any(String));

        expect(await getById("a")).toEqual({alias: "a", currency: "b", multiplier: 10});
    });

    test("add - duplicated", async () => {
        await CurrencyExchange.save({currency: "b", rate: 123, date: new Date()});
        await add("duplicated", "b", 100);
        const query = gql`
            mutation ($alias: String!, $multiplier: Float!, $currency: String!) {
                addCurrencyAlias(data: {alias: $alias, multiplier: $multiplier, currency: $currency})
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {alias: "duplicated", multiplier: 10, currency: ""}).expect(200);
        expect(res.body.errors[0].message).toEqual("Item already exists");
    });

    test("edit", async () => {
        await CurrencyExchange.save({currency: "c", rate: 123, date: new Date()});
        await add("edit", "b", 100);
        const query = gql`
            mutation ($data: CurrencyAliasInput!) {
                editCurrencyAlias(alias: "edit", data: $data)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {data: {alias: "edit-2", multiplier: 200, currency: "c"}}).expect(200);
        expect(res.body.data.editCurrencyAlias).toEqual(true);

        expect(await getById("edit-2")).toEqual({alias: "edit-2", multiplier: 200, currency: "c"});
    });

    test("edit - duplicated", async () => {
        await add("edit-duplicated", "b", 100);
        await add("edit-duplicated-2", "b", 100);
        const query = gql`
            mutation ($data: CurrencyAliasInput!) {
                editCurrencyAlias(alias: "edit-duplicated-2", data: $data)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {data: {alias: "edit-duplicated", multiplier: 200, currency: "c"}}).expect(200);
        expect(res.body.errors[0].message).toEqual("Item already exists");
    });

    test("delete", async () => {
        await add("delete", "b", 100);
        const query = gql`
            mutation {
                deleteCurrencyAlias(alias: "delete")
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query).expect(200);
        expect(res.body.data.deleteCurrencyAlias).toEqual(true);

        expect(await getById("delete")).toBeUndefined();
    });
});
