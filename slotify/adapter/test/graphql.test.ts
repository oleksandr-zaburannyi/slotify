import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {gql} from "graphql-request";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {TransactionCube} from "../db/model/TransactionCube";
import {Account} from "../db/model/Account";
import {Player} from "../db/model/Player";
import {cleanupAfterTests} from "./cleanup";
import wait from "@slotify/shared/lib/wait";
import {Game} from "../db/model/Game";
import {Rgs} from "../db/model/Rgs";
import {Wallet} from "../db/model/Wallet";

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

describe("graphql", () => {
    test("unauthorized user", async () => {
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
        const res = await graphQlRequest(api, await accountToken(api, "wrong-user@example.com", "wrong-password"), query, {}).expect(200);

        expect(res.body.data.__schema.queryType.fields).toEqual([{name: "ping"}]);
        expect(res.body.data.__schema.mutationType.fields).toEqual([{name: "resetPassword"}, {name: "changePassword"}, {name: "login"}, {name: "logout"}]);
    });

    test("ping", async () => {
        const query = gql`
            query {
                ping
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api, "wrong-user@example.com", "wrong-password"), query, {}).expect(200);

        expect(res.body.data.ping).toEqual(true);
    });

    test("gameList", async () => {
        const query = gql`
            query {
                gameList
            }
        `;

        await TransactionCube.insert({game: "game1", wallet: "wallet1"});
        await TransactionCube.insert({game: "game2", wallet: "wallet2"});

        //all permissions
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.gameList).toEqual(["game1", "game2"]);

        //partial permission
        const account1 = await Account.create({email: "test1@test.com", password: Account.hashPassword("pass"), wallets: ["wallet1"]}).save();
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query, {}).expect(200);
        expect(res2.body.data.gameList).toEqual(["game1"]);

        await TransactionCube.clear();
    });

    test("providerList", async () => {
        const query = gql`
            query {
                providerList
            }
        `;

        await TransactionCube.insert({provider: "provider1", operator: "operator1"});
        await TransactionCube.insert({provider: "provider2", operator: "operator2"});

        //all permissions
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.providerList).toEqual(["provider1", "provider2"]);

        //partial permission
        const account1 = await Account.create({email: "test2@test.com", password: Account.hashPassword("pass"), operators: ["operator1"]}).save();
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query, {}).expect(200);
        expect(res2.body.data.providerList).toEqual(["provider1"]);

        await TransactionCube.clear();
    });

    test("operatorList", async () => {
        const query = gql`
            query {
                operatorList
            }
        `;

        await Player.insert({wallet: "wallet1", operator: "operator1", brand: "brand1", nativeId: "nativeId1", currency: "eur"});
        await Player.insert({wallet: "wallet2", operator: "operator2", brand: "brand2", nativeId: "nativeId2", currency: "eur"});

        //all permissions
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.operatorList).toEqual(["operator1", "operator2"]);

        //partial permission
        const account1 = await Account.create({email: "test3@test.com", password: Account.hashPassword("pass"), brands: ["brand1"]}).save();
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query, {}).expect(200);
        expect(res2.body.data.operatorList).toEqual(["operator1"]);

        await Player.clear();
    });

    test("brandList", async () => {
        const query = gql`
            query {
                brandList
            }
        `;

        await Player.insert({wallet: "wallet1", operator: "operator1", brand: "brand1", nativeId: "nativeId1", currency: "eur"});
        await Player.insert({wallet: "wallet2", operator: "operator2", brand: "brand2", nativeId: "nativeId2", currency: "eur"});

        //all permissions
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.brandList).toEqual(["brand1", "brand2"]);

        //partial permission
        const account1 = await Account.create({email: "test4@test.com", password: Account.hashPassword("pass"), wallets: ["wallet1"]}).save();
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query, {}).expect(200);
        expect(res2.body.data.brandList).toEqual(["brand1"]);

        await Player.clear();
    });

    test("jurisdictionList", async () => {
        const query = gql`
            query {
                jurisdictionList
            }
        `;

        await Player.insert({wallet: "wallet1", operator: "operator1", brand: "brand1", nativeId: "nativeId1", currency: "eur", jurisdiction: "mt"});
        await Player.insert({wallet: "wallet2", operator: "operator2", brand: "brand2", nativeId: "nativeId2", currency: "eur"});

        //all permissions
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.jurisdictionList).toEqual(["mt"]);

        //partial permission
        const account1 = await Account.create({email: "test5@test.com", password: Account.hashPassword("pass"), wallets: ["wallet2"]}).save();
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query, {}).expect(200);
        expect(res2.body.data.jurisdictionList).toEqual([]);

        await Player.clear();
    });

    test("walletList", async () => {
        const query = gql`
            query {
                walletList
            }
        `;

        await TransactionCube.insert({game: "game1", wallet: "wallet1"});
        await TransactionCube.insert({game: "game2", wallet: "wallet2"});

        //all permissions
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.walletList).toEqual(["wallet1", "wallet2"]);

        //partial permission
        const account1 = await Account.create({email: "test6@test.com", password: Account.hashPassword("pass"), wallets: ["wallet1"]}).save();
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query, {}).expect(200);
        expect(res2.body.data.walletList).toEqual(["wallet1"]);

        await TransactionCube.clear();
    });

    test("rgsList", async () => {
        const query = gql`
            query {
                rgsList
            }
        `;

        await TransactionCube.insert({game: "game1", rgs: "rgs1"});
        await TransactionCube.insert({game: "game2", rgs: "rgs2"});

        //all permissions
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.rgsList).toEqual(["rgs1", "rgs2"]);

        //partial permission
        const account1 = await Account.create({email: "test7@test.com", password: Account.hashPassword("pass"), rgss: ["rgs1"]}).save();
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query, {}).expect(200);
        expect(res2.body.data.rgsList).toEqual(["rgs1"]);

        await TransactionCube.clear();
    });

    test("games - add, edit, delete", async () => {
        const adminToken = await accountToken(api);
        //add
        const query1 = gql`
            mutation ($data: GameInput!) {
                addGame(data: $data)
            }
        `;
        const res1 = await graphQlRequest(api, adminToken, query1, {data: {game: "test-game1", rgs: "tequity", provider: "tequity", wallets: ["test-wallet1", "test-wallet2"]}}).expect(200);
        expect(res1.body.data.addGame).toEqual(true);
        await wait(10);
        expect(await Game.allGames()).toEqual([
            {
                brands: null,
                game: "test-game1",
                inspectionConfig: null,
                operators: null,
                provider: "tequity",
                rgs: "tequity",
                rgsConfig: null,
                rgsGame: null,
                title: null,
                type: null,
                wallets: ["test-wallet1", "test-wallet2"],
            },
        ]);
        const {game} = (await Game.findOneBy({game: "test-game1"}))!;

        //edit
        const query2 = gql`
            mutation ($game: ID!, $data: GameInput!) {
                editGame(game: $game, data: $data)
            }
        `;
        const res2 = await graphQlRequest(api, adminToken, query2, {game, data: {game, wallets: ["test-wallet1"]}}).expect(200);
        expect(res2.body.data.editGame).toEqual(true);
        await wait(10);
        expect(await Game.allGames()).toEqual([
            {
                brands: null,
                game: "test-game1",
                inspectionConfig: null,
                operators: null,
                provider: "tequity",
                rgs: "tequity",
                rgsConfig: null,
                rgsGame: null,
                title: null,
                type: null,
                wallets: ["test-wallet1"],
            },
        ]);

        //delete
        const query3 = gql`
            mutation ($game: ID!) {
                deleteGame(game: $game)
            }
        `;
        const res3 = await graphQlRequest(api, adminToken, query3, {game}).expect(200);
        expect(res3.body.data.deleteGame).toEqual(true);
        await wait(10);
        expect(await Game.allGames()).toEqual([]);
    });

    test("games - add, edit, delete with false permissions", async () => {
        const adminToken = await accountToken(api);
        //add
        const query1 = gql`
            mutation ($data: GameInput!) {
                addGame(data: $data)
            }
        `;
        const res1 = await graphQlRequest(api, adminToken, query1, {data: {game: "test-game1", rgs: "tequity", provider: "tequity", wallets: ["test-wallet1", "test-wallet2"]}}).expect(200);
        expect(res1.body.data.addGame).toEqual(true);
        await wait(10);
        expect(await Game.allGames()).toEqual([
            {
                brands: null,
                game: "test-game1",
                inspectionConfig: null,
                operators: null,
                provider: "tequity",
                rgs: "tequity",
                rgsConfig: null,
                rgsGame: null,
                title: null,
                type: null,
                wallets: ["test-wallet1", "test-wallet2"],
            },
        ]);
        const {game} = (await Game.findOneBy({game: "test-game1"}))!;

        const account1 = await Account.create({email: "test8@test.com", password: Account.hashPassword("pass"), wallets: ["test-wallet1"]}).save();
        //edit
        const query2 = gql`
            mutation ($game: ID!, $data: GameInput!) {
                editGame(game: $game, data: $data)
            }
        `;
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query2, {game, data: {game, wallets: ["test-wallet1"]}}).expect(200);
        expect(res2.body.errors.length > 0).toEqual(true);
        await wait(10);
        expect(await Game.allGames()).toEqual([
            {
                brands: null,
                game: "test-game1",
                inspectionConfig: null,
                operators: null,
                provider: "tequity",
                rgs: "tequity",
                rgsConfig: null,
                rgsGame: null,
                title: null,
                type: null,
                wallets: ["test-wallet1", "test-wallet2"],
            },
        ]);

        const account2 = await Account.create({email: "test9@test.com", password: Account.hashPassword("pass"), rgss: ["rsi"]}).save();
        //delete
        const query3 = gql`
            mutation ($game: ID!) {
                deleteGame(game: $game)
            }
        `;
        const res3 = await graphQlRequest(api, await accountToken(api, account2.email, "pass"), query3, {game}).expect(200);
        expect(res3.body.errors.length > 0).toEqual(true);
        await wait(10);
        expect(await Game.allGames()).toEqual([
            {
                brands: null,
                game: "test-game1",
                inspectionConfig: null,
                operators: null,
                provider: "tequity",
                rgs: "tequity",
                rgsConfig: null,
                rgsGame: null,
                title: null,
                type: null,
                wallets: ["test-wallet1", "test-wallet2"],
            },
        ]);
    });

    test("rgs - add, edit, delete with false permissions", async () => {
        const adminToken = await accountToken(api);
        //add
        const query1 = gql`
            mutation ($data: RGSInput!) {
                addRgs(data: $data)
            }
        `;
        const res1 = await graphQlRequest(api, adminToken, query1, {data: {id: "test-rgs1", adapter: "standard", config: {test: "config"}}}).expect(200);
        expect(res1.body.data.addRgs).toEqual(true);
        await wait(10);
        const rgs = await Rgs.findOneBy({id: "test-rgs1"});
        expect(rgs).toEqual(
            expect.objectContaining({
                id: "test-rgs1",
                adapter: "standard",
                config: {test: "config"},
            }),
        );

        const account1 = await Account.create({email: "test10@test.com", password: Account.hashPassword("pass"), rgss: ["different-rgs"]}).save();
        //edit
        const query2 = gql`
            mutation ($id: ID!, $data: RGSInput!) {
                editRgs(id: $id, data: $data)
            }
        `;
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query2, {id: "test-rgs1", data: {id: "test-rgs1", adapter: "standard", config: {test: "updated"}}}).expect(200);
        expect(res2.body.errors.length > 0).toEqual(true);
        await wait(10);
        const rgsAfterEdit = await Rgs.findOneBy({id: "test-rgs1"});
        expect(rgsAfterEdit!.config).toEqual({test: "config"});

        const account2 = await Account.create({email: "test11@test.com", password: Account.hashPassword("pass"), rgss: ["another-rgs"]}).save();
        //delete
        const query3 = gql`
            mutation ($id: ID!) {
                deleteRgs(id: $id)
            }
        `;
        const res3 = await graphQlRequest(api, await accountToken(api, account2.email, "pass"), query3, {id: "test-rgs1"}).expect(200);
        expect(res3.body.errors.length > 0).toEqual(true);
        await wait(10);
        const rgsAfterDelete = await Rgs.findOneBy({id: "test-rgs1"});
        expect(rgsAfterDelete).toBeDefined();
    });

    test.only("wallets - add, edit, delete with false permissions", async () => {
        const adminToken = await accountToken(api);
        //add
        const query1 = gql`
            mutation ($data: WalletInput!) {
                addWallet(data: $data)
            }
        `;
        const res1 = await graphQlRequest(api, adminToken, query1, {data: {id: "test-wallet1", adapter: "standard", config: {test: "config"}, enabled: true}}).expect(200);
        expect(res1.body.data.addWallet).toEqual(expect.any(String));
        await wait(10);
        const wallet = await Wallet.findOneBy({id: "test-wallet1"});
        expect(wallet).toEqual(
            expect.objectContaining({
                id: "test-wallet1",
                adapter: "standard",
            }),
        );

        const account1 = await Account.create({email: "test12@test.com", password: Account.hashPassword("pass"), wallets: ["different-wallet"]}).save();
        //edit
        const query2 = gql`
            mutation ($id: ID!, $data: WalletInput!) {
                editWallet(id: $id, data: $data)
            }
        `;
        const res2 = await graphQlRequest(api, await accountToken(api, account1.email, "pass"), query2, {id: "test-wallet1", data: {id: "test-wallet1", adapter: "standard", config: {test: "updated"}, enabled: true}}).expect(200);
        expect(res2.body.errors.length > 0).toEqual(true);
        await wait(10);
        const walletAfterEdit = await Wallet.findOneBy({id: "test-wallet1"});
        expect(walletAfterEdit!.config).toEqual({test: "config"});

        const account2 = await Account.create({email: "test13@test.com", password: Account.hashPassword("pass"), wallets: ["another-wallet"]}).save();
        //delete
        const query3 = gql`
            mutation ($id: ID!) {
                deleteWallet(id: $id)
            }
        `;
        const res3 = await graphQlRequest(api, await accountToken(api, account2.email, "pass"), query3, {id: "test-wallet1"}).expect(200);
        expect(res3.body.errors.length > 0).toEqual(true);
        await wait(10);
        const walletAfterDelete = await Wallet.findOneBy({id: "test-wallet1"});
        expect(walletAfterDelete).toBeDefined();
    });
});
