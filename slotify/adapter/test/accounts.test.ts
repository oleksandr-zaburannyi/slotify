import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {gql} from "graphql-request";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {PasswordReset} from "../db/model/PasswordReset";
import {Account} from "../db/model/Account";
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

const sendMail = jest.fn();
jest.mock("nodemailer", () => ({
    createTransport: () => ({
        verify: jest.fn(),
        sendMail,
    }),
}));

const getById = async (id: string) => {
    const query = gql`
        query ($id: JSON) {
            accounts(filter: [{field: "email", type: EQUAL, value: $id}]) {
                items {
                    email
                    permissions
                    wallets
                    brands
                    operators
                    providers
                }
            }
        }
    `;
    const res = await graphQlRequest(api, await accountToken(api), query, {id}).expect(200);
    return res.body.data.accounts.items[0];
};
type IAccount = {email: string; operators: string[]; brands: string[]; wallets: string[]; providers: string[]; permissions: string[]};

const add = async (data: IAccount) => {
    const query = gql`
        mutation ($data: AccountInput!) {
            addAccount(data: $data)
        }
    `;
    const res = await graphQlRequest(api, await accountToken(api), query, {data}).expect(200);
    return res.body;
};

describe("accounts", () => {
    test("incorrect login", async () => {
        const query = gql`
            mutation ($email: String!, $password: String!) {
                login(email: $email, password: $password) {
                    account {
                        email
                        permissions
                        wallets
                        brands
                        operators
                        providers
                    }
                }
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {email: "non@existing.com", password: "123"}).expect(200);
        expect(res.body.errors[0].message).toEqual("Incorrect email or password");
    });

    test("get", async () => {
        const query = gql`
            query {
                accounts {
                    items {
                        email
                        permissions
                        wallets
                        brands
                        operators
                        providers
                    }
                }
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query).expect(200);
        expect(res.body.data.accounts.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    "email": "contact@tequity.ventures",
                    "brands": null,
                    "wallets": null,
                    "operators": null,
                    providers: null,
                    "permissions": expect.arrayContaining([
                        "availableBets",
                        "campaigns",
                        "manageCampaigns",
                        "auditLogs",
                        "wallets",
                        "rgss",
                        "accounts",
                        "players",
                        "transactions",
                        "gameWin",
                        "currencyExchange",
                        "currencyAliases",
                        "manageAccounts",
                        "manageCurrencies",
                        "manageRgss",
                        "manageWallets",
                        "closeTransaction",
                        "settings",
                        "fixedCurrencyRates",
                        "manageSettings",
                        "verifier",
                        "graphiql",
                        "criticalFiles",
                        "manageCriticalFiles",
                        "manageGames",
                        "games",
                        "sessions",
                        "endSession",
                        "rtpMonitoring",
                        "manageRtpMonitoring",
                        "managePlayers",
                        "gameplay",
                        "rooms",
                        "manageRooms",
                        "regenerateGameWin",
                        "reportSender",
                        "manageReportSender",
                        "manageThemes",
                        "reportExclusion",
                        "manageReportExclusion",
                    ]),
                }),
            ]),
        );
    });

    test("add, set password and login", async () => {
        sendMail.mockReset();
        const email = "test@test.com";
        const account: IAccount = {email, operators: ["test-operator"], brands: ["test-brand"], providers: ["test-provider"], wallets: ["test-wallet"], permissions: ["accounts"]};
        expect((await add(account)).data.addAccount).toEqual(expect.any(String));
        expect(sendMail).toHaveBeenCalled();

        const {key} = (await PasswordReset.findOneBy({email}))!;

        const query = gql`
            mutation ($key: String!, $password: String!) {
                changePassword(key: $key, password: $password) {
                    email
                }
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {key, password: "test-password"}).expect(200);
        expect(res.body.data.changePassword).toEqual({email});

        const query2 = gql`
            mutation ($email: String!, $password: String!) {
                login(email: $email, password: $password) {
                    account {
                        email
                        permissions
                        wallets
                        brands
                        operators
                        providers
                    }
                }
            }
        `;
        const res2 = await graphQlRequest(api, await accountToken(api), query2, {email, password: "test-password"}).expect(200);
        expect(res2.body.data.login).toEqual({account});
    });

    test("add - duplicated", async () => {
        const account: IAccount = {email: "duplicated@email.com", operators: ["test-operator"], brands: ["test-brand"], providers: ["test-provider"], wallets: ["test-wallet"], permissions: ["accounts"]};
        await add(account);
        const query = gql`
            mutation ($data: AccountInput!) {
                addAccount(data: $data)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {data: account}).expect(200);
        expect(res.body.errors[0].message).toEqual("Item already exists");
    });

    test("edit", async () => {
        const email = "edit@email.com";
        const account: IAccount = {email, operators: ["test-operator"], brands: ["test-brand"], providers: ["test-provider"], wallets: ["test-wallet"], permissions: ["accounts"]};
        await add(account);

        const account2: IAccount = {email, operators: ["test-operator2"], brands: ["test-brand2"], providers: ["test-provider2"], wallets: ["test-wallet2"], permissions: ["accounts"]};
        const query = gql`
            mutation ($id: ID!, $data: AccountInput!) {
                editAccount(id: $id, data: $data)
            }
        `;
        await graphQlRequest(api, await accountToken(api), query, {id: email, data: account2}).expect(200);
        expect(await getById(email)).toEqual(account2);
    });

    test("edit - duplicated", async () => {
        const account: IAccount = {email: "", operators: ["test-operator"], brands: ["test-brand"], providers: ["test-provider"], wallets: ["test-wallet"], permissions: ["accounts"]};
        await add({...account, email: "edit1@edit.com"});
        await add({...account, email: "edit2@edit.com"});
        const query = gql`
            mutation ($data: AccountInput!) {
                editAccount(id: "edit1@edit.com", data: $data)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {data: {...account, email: "edit2@edit.com"}}).expect(200);
        expect(res.body.errors[0].message).toEqual("Item already exists");
    });

    test("edit - yourself", async () => {
        const email = "contact@tequity.ventures";
        const account: IAccount = {email, operators: ["test-operator"], brands: ["test-brand"], providers: ["test-provider"], wallets: ["test-wallet"], permissions: ["accounts"]};
        const query = gql`
            mutation ($data: AccountInput!) {
                editAccount(id: "contact@tequity.ventures", data: $data)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {data: account}).expect(200);
        expect(res.body.errors[0].message).toEqual("You cannot edit your account");
    });

    test("delete", async () => {
        const email = "remove@email.com";
        const account: IAccount = {email, operators: ["test-operator"], brands: ["test-brand"], providers: ["test-provider"], wallets: ["test-wallet"], permissions: ["accounts"]};

        await add(account);
        const query = gql`
            mutation ($email: ID!) {
                deleteAccount(id: $email)
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {email}).expect(200);
        expect(res.body.data.deleteAccount).toEqual(true);

        expect(await getById(email)).toBeUndefined();
    });

    test("delete - yourself", async () => {
        const query = gql`
            mutation {
                deleteAccount(id: "contact@tequity.ventures")
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.errors[0].message).toEqual("You cannot delete your account");
    });

    test("resetPassword, changePassword and login", async () => {
        const email = "contact@tequity.ventures";
        sendMail.mockReset();
        const query = gql`
            mutation ($email: String!) {
                resetPassword(email: $email)
            }
        `;
        await graphQlRequest(api, await accountToken(api), query, {email}).expect(200);
        expect(sendMail).toHaveBeenCalled();

        const {key} = (await PasswordReset.findOneBy({email}))!;

        const query2 = gql`
            mutation ($key: String!, $password: String!) {
                changePassword(key: $key, password: $password) {
                    email
                }
            }
        `;
        const res2 = await graphQlRequest(api, await accountToken(api), query2, {key, password: "test-password-2"}).expect(200);
        expect(res2.body.data.changePassword).toEqual({email});

        const query3 = gql`
            mutation ($email: String!, $password: String!) {
                login(email: $email, password: $password) {
                    account {
                        email
                        permissions
                        wallets
                        brands
                        operators
                        providers
                    }
                }
            }
        `;
        const res3 = await graphQlRequest(api, await accountToken(api), query3, {email, password: "test-password-2"}).expect(200);
        expect(res3.body.data.login).not.toBeUndefined();
    });

    test("add - permissions check", async () => {
        await Account.create({email: "test@operator.com", password: Account.hashPassword("pass"), wallets: ["w1", "w2"], operators: ["o2"], permissions: ["gameWin"]}).save();

        const query = gql`
            query {
                __schema {
                    mutationType {
                        fields {
                            name
                        }
                    }
                    queryType {
                        fields {
                            name
                        }
                    }
                }
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api, "test@operator.com", "pass"), query, {}).expect(200);

        expect(res.body.data.__schema.queryType.fields).toEqual([
            {name: "ping"},
            {name: "gameWin"},
            {name: "rgsList"},
            {name: "walletList"},
            {name: "gameList"},
            {name: "providerList"},
            {name: "operatorList"},
            {name: "brandList"},
            {name: "jurisdictionList"},
            {name: "currencyList"},
        ]);
        expect(res.body.data.__schema.mutationType.fields).toEqual([{name: "resetPassword"}, {name: "changePassword"}, {name: "login"}, {name: "logout"}]);
    });
});
