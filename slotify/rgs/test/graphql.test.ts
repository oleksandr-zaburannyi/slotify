import {afterAll, beforeAll, describe, test} from "@jest/globals";
import {gql} from "graphql-request";
import {closeDatabase, closeServer, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {Settings} from "../db/model/Settings";
import {Wager} from "../db/model/Wager";
import {v4} from "uuid";
import {Round} from "../db/model/Round";
import {Currency} from "../db/model/Currency";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {closeRedis} from "@slotify/shared/lib/redis";
import {stopScheduler} from "@slotify/shared/lib/scheduler";
import {stopIntervals} from "../util/metrics";

jest.mock("@slotify/shared/lib/fetch");
jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));

const mockedFetch = fetchAndParse as jest.MockedFunction<typeof fetchAndParse>;

const mockResponse = (response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(response));
};

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await closeServer();
    await closeDatabase();
    await closeRedis();
    stopScheduler();
    stopIntervals();
});

const createSettings = async (data: Partial<Settings> = {}) => {
    const settings = Settings.create({...data}) as Settings;
    await settings.save();
    const obj: any = {...settings, id: settings.id.toString()};
    delete obj.comment;
    return obj;
};

const createWager = async (data: Partial<Wager> = {}) => {
    const roundId = v4();
    const wager = Wager.create({step: await Wager.countBy({roundId}), auto: false, roundId, action: "test-action", ...data}) as Wager;
    await wager.save();
    const obj: any = {...wager, createdAt: wager.createdAt.getTime()};
    delete obj.id;
    delete obj.updatedAt;
    delete obj.step;
    return obj;
};

const createRound = async (data: Partial<Round> = {}) => {
    const round = Round.create({roundId: v4(), playerId: v4(), game: "game", status: "finished", ...data}) as Round;
    await round.save();
    const obj: any = {...round, createdAt: round.createdAt.getTime()};
    delete obj.id;
    delete obj.failReason;
    delete obj.updatedAt;
    return obj;
};

const createCurrency = async (data: Partial<Currency> = {}) => {
    const currency = Currency.create({...data});
    await currency.save();
    const obj: any = {...currency};
    return obj;
};

describe("rgs - graphql", () => {
    test("settings", async () => {
        await Settings.clear();
        const s1 = await createSettings({priority: 1, key: "s1", value: "v1", serverOnly: true});
        const s2 = await createSettings({priority: 2, key: "s2", value: "v2", serverOnly: true});
        const s3 = await createSettings({priority: 3, key: "s3", value: "v3", serverOnly: true});
        const s4 = await createSettings({priority: 4, key: "s4", value: "v4", serverOnly: true});

        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                settings(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        priority
                        key
                        value
                        serverOnly
                        brands
                        games
                        id
                        jurisdictions
                        operators
                        providers
                        wallets
                        currencies
                    }
                }
            }
        `;

        //page 1
        const res = await graphQlRequest(api, "", query, {limit: 2, sort: {field: "priority", order: "ASC"}}, {}).expect(200);
        expect(res.body.data).toEqual({settings: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [s1, s2]}});

        //page 2
        const res2 = await graphQlRequest(api, "", query, {limit: 2, offset: 2, sort: {field: "priority", order: "ASC"}}, {}).expect(200);
        expect(res2.body.data).toEqual({settings: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [s3, s4]}});

        //search
        const res3 = await graphQlRequest(api, "", query, {filter: [{field: "key", type: "EQUAL", value: "s4"}]}, {}).expect(200);
        expect(res3.body.data).toEqual({settings: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [s4]}});
    });

    test("wagers", async () => {
        const wager = await createWager();

        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                wagers(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        createdAt
                        roundId
                        data
                        action
                        auto
                        bet
                        next
                        state
                        params
                        win
                    }
                }
            }
        `;

        const res = await graphQlRequest(api, "", query, {filter: [{field: "roundId", type: "EQUAL", value: wager.roundId}]}).expect(200);
        expect(res.body.data).toEqual({wagers: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [wager]}});

        const res2 = await graphQlRequest(api, "", query, {}).expect(200);
        expect(res2.body.errors).toBeDefined();
    });

    test("rounds", async () => {
        const round = await createRound();

        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                rounds(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        createdAt
                        roundId
                        status
                        playerId
                        variant
                        game
                    }
                }
            }
        `;

        const res = await graphQlRequest(api, "", query, {filter: [{field: "roundId", type: "EQUAL", value: round.roundId}]}).expect(200);
        expect(res.body.data).toEqual({rounds: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [round]}});

        const res2 = await graphQlRequest(api, "", query, {}).expect(200);
        expect(res2.body.errors).toBeDefined();
    });

    test("fixedCurrencyRates", async () => {
        mockResponse({currencies: [{currency: "sek", rate: 1.23}]});
        const currencies = await Currency.find();
        await Currency.clear();
        const c1 = await createCurrency({currency: "sek", fixedRate: 1, symbol: null});
        const c2 = await createCurrency({currency: "eur", fixedRate: 2, symbol: "a"});
        const c3 = await createCurrency({currency: "usd", fixedRate: 5, symbol: null});
        const c4 = await createCurrency({currency: "btc", fixedRate: 100, symbol: null});

        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                fixedCurrencyRates(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        currency
                        fixedRate
                        symbol
                    }
                }
            }
        `;

        //page 1
        const res = await graphQlRequest(api, "", query, {limit: 2, sort: {field: "fixedRate", order: "ASC"}}).expect(200);
        expect(res.body.data).toEqual({fixedCurrencyRates: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [c1, c2]}});

        //page 2
        const res2 = await graphQlRequest(api, "", query, {limit: 2, offset: 2, sort: {field: "fixedRate", order: "ASC"}}).expect(200);
        expect(res2.body.data).toEqual({fixedCurrencyRates: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [c3, c4]}});

        //search
        const res3 = await graphQlRequest(api, "", query, {filter: [{field: "currency", type: "EQUAL", value: "btc"}]}).expect(200);
        expect(res3.body.data).toEqual({fixedCurrencyRates: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [c4]}});

        await Currency.clear();
        await Currency.insert(currencies);
    });

    test("fixedCurrencyRates - add, edit, delete", async () => {
        //add
        const query1 = gql`
            mutation ($data: FixedCurrencyRateInput!) {
                addFixedCurrencyRate(data: $data)
            }
        `;
        const res1 = await graphQlRequest(api, "", query1, {data: {currency: "abc", fixedRate: 123, decimals: 5}}).expect(200);
        expect(res1.body.data.addFixedCurrencyRate).toEqual(expect.any(String));
        expect(await Currency.findBy({currency: "abc"})).toEqual([{currency: "abc", fixedRate: 123, symbol: null, decimals: 5}]);

        //edit
        const query2 = gql`
            mutation ($currency: ID!, $data: FixedCurrencyRateInput!) {
                editFixedCurrencyRate(currency: $currency, data: $data)
            }
        `;
        const res2 = await graphQlRequest(api, "", query2, {currency: "abc", data: {currency: "xyz", fixedRate: 456, symbol: "a", decimals: 5}}).expect(200);
        expect(res2.body.data.editFixedCurrencyRate).toEqual(true);
        expect(await Currency.findBy({currency: "abc"})).toEqual([]);
        expect(await Currency.findBy({currency: "xyz"})).toEqual([{currency: "xyz", fixedRate: 456, symbol: "a", decimals: 5}]);

        //delete
        const query3 = gql`
            mutation ($currency: ID!) {
                deleteFixedCurrencyRate(currency: $currency)
            }
        `;
        const res3 = await graphQlRequest(api, "", query3, {currency: "xyz"}).expect(200);
        expect(res3.body.data.deleteFixedCurrencyRate).toEqual(true);
        expect(await Currency.findBy({currency: "xyz"})).toEqual([]);
    });

    test("providerList", async () => {
        mockResponse({"provider": ["game1", "game2"]});
        const query = gql`
            query {
                providerList
            }
        `;

        //permission
        const res1 = await graphQlRequest(api, "", query, {}, {}).expect(200);
        expect(res1.body.data.providerList).toEqual(["provider"]);

        //permission explicit
        const res2 = await graphQlRequest(api, "", query, {}, {providers: ["provider"]}).expect(200);
        expect(res2.body.data.providerList).toEqual(["provider"]);

        //no permission
        const res3 = await graphQlRequest(api, "", query, {}, {providers: ["another-provider"]}).expect(200);
        expect(res3.body.data.providerList).toEqual([]);
    });

    test("gameList", async () => {
        mockResponse({"provider": ["game1", "game2"]});
        const query = gql`
            query {
                gameList
            }
        `;

        //permission
        const res1 = await graphQlRequest(api, "", query, {}, {}).expect(200);
        expect(res1.body.data.gameList).toEqual(["game1", "game2"]);

        //permission explicit
        const res2 = await graphQlRequest(api, "", query, {}, {providers: ["provider"]}).expect(200);
        expect(res2.body.data.gameList).toEqual(["game1", "game2"]);

        //no permission
        const res3 = await graphQlRequest(api, "", query, {}, {providers: ["another-provider"]}).expect(200);
        expect(res3.body.data.gameList).toEqual([]);
    });
});
