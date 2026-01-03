import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {gql} from "graphql-request";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
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

const getById = async (id: string) => {
    const query = gql`
        query ($id: JSON) {
            rgss(filter: [{field: "id", type: EQUAL, value: $id}]) {
                items {
                    adapter
                    config
                    id
                }
            }
        }
    `;
    const res = await graphQlRequest(api, await accountToken(api), query, {id}).expect(200);
    return res.body.data.rgss.items[0];
};

const add = async (id: string, adapter: string, config: any) => {
    const query = gql`
        mutation ($config: JSONObject, $id: ID!, $adapter: String) {
            addRgs(data: {id: $id, adapter: $adapter, config: $config})
        }
    `;
    const res = await graphQlRequest(api, await accountToken(api), query, {config, id, adapter}).expect(200);
    return res.body;
};

describe("rgss", () => {
    test("get", async () => {
        const query = gql`
            query {
                rgss {
                    items {
                        adapter
                        config
                        id
                    }
                }
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query).expect(200);
        expect(res.body.data.rgss.items).toContainEqual({id: "test-rgs", adapter: "standard", config: expect.any(Object)});
    });

    test("add", async () => {
        expect((await add("test-id-add", "test-adapter", {test: "abc"})).data.addRgs).toEqual(expect.any(String));

        expect(await getById("test-id-add")).toEqual({id: "test-id-add", adapter: "test-adapter", config: {test: "abc"}});
    });

    test("add - duplicated", async () => {
        await add("test-id-add-duplicated", "", {});
        const query = gql`
            mutation ($config: JSONObject, $id: ID!, $adapter: String) {
                addRgs(data: {id: $id, adapter: $adapter, config: $config})
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {config: {}, id: "test-id-add-duplicated", adapter: ""}).expect(200);
        expect(res.body.errors[0].message).toEqual("Item already exists");
    });

    test("edit", async () => {
        await add("test-id-edit", "test-adapter", {});
        const query = gql`
            mutation ($data: RGSInput!) {
                editRgs(id: "test-id-edit", data: $data)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {data: {id: "test-id-edit-2", adapter: "test-adapter-2", config: {test: "abcd"}}}).expect(200);
        expect(res.body.data.editRgs).toEqual(true);

        expect(await getById("test-id-edit-2")).toEqual({id: "test-id-edit-2", adapter: "test-adapter-2", config: {test: "abcd"}});
    });

    test("edit - duplicated", async () => {
        await add("test-id-edit-duplicated", "", {});
        await add("test-id-edit-duplicated-2", "", {});
        const query = gql`
            mutation ($data: RGSInput!) {
                editRgs(id: "test-id-edit-duplicated-2", data: $data)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {data: {id: "test-id-edit-duplicated", adapter: "", config: {}}}).expect(200);
        expect(res.body.errors[0].message).toEqual("Item already exists");
    });

    test("delete", async () => {
        await add("test-id-delete", "test-adapter", {});
        const query = gql`
            mutation {
                deleteRgs(id: "test-id-delete")
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query).expect(200);
        expect(res.body.data.deleteRgs).toEqual(true);

        expect(await getById("test-id-delete")).toBeUndefined();
    });
});
