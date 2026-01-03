import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import * as request from "supertest";
import fetch from "@slotify/shared/lib/fetch";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {gql} from "graphql-request";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {DateTime} from "../util/luxon";
import {cleanupAfterTests} from "./cleanup";
import {fetchCurrencies} from "../currencyFeed/currencyFeed";
import {CurrencyFeed} from "../db/model/CurrencyFeed";

let api: Express;

beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
    await CurrencyFeed.update({feed: "currencyLayer"}, {enabled: true});
    await CurrencyFeed.update({feed: "coinAPI"}, {enabled: true});
});

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/sendAlert", () => ({sendAlert: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");

describe("currencies", () => {
    test("empty currencies", async () => {
        const {body} = await request(api).get("/api/currencies").expect(200);
        expect(body).toEqual({currencies: []});
    });

    test("fetch currencies", async () => {
        const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
        mockedFetch.mockImplementation(url =>
            Promise.resolve({
                json: () => {
                    if (url.toString().includes("coinapi.io")) return Promise.resolve([{rate_close: 0.0001}]);
                    if (url.toString().includes("currencylayer.com")) return Promise.resolve({success: true, quotes: {"USDEUR": 2, "USDSEK": 100}});
                },
                text: () => {
                    if (url.toString().includes("ecb"))
                        return Promise.resolve(`
                        <gesmes:Envelope>
                            <Cube>
                                <Cube time='${DateTime.local().minus({days: 2}).toFormat("yyyy-MM-dd")}'>
                                    <Cube currency='USD' rate='0.502'/>
                                    <Cube currency='PLN' rate='4.5'/>
                                </Cube>
                                <Cube time='${DateTime.local().minus({days: 1}).toFormat("yyyy-MM-dd")}'>
                                    <Cube currency='USD' rate='0.502'/>
                                    <Cube currency='SEK' rate='5'/>
                                    <Cube currency='PLN' rate='40.5'/>
                                </Cube>
                            </Cube>
                        </gesmes:Envelope>
`);
                },
            } as any),
        );

        await fetchCurrencies();

        const {body} = await request(api).get("/api/currencies").expect(200);

        expect(body.currencies.find(({currency}: any) => currency === "eur").rate).toEqual(1);
        expect(body.currencies.find(({currency}: any) => currency === "btc").rate).toEqual(0.0001);
        expect(body.currencies.find(({currency}: any) => currency === "eth").rate).toEqual(0.0001);

        //100 sek rate from one of the feed will be rejected
        expect(body.currencies.find(({currency}: any) => currency === "sek").rate).toEqual(5);

        //one feed return 1, another 0.5, so we take average of 0.75
        expect(body.currencies.find(({currency}: any) => currency === "usd").rate).toEqual(0.502);

        //rate 40.5 had too big difference from previous day so it was no accepted
        expect(body.currencies.find(({currency}: any) => currency === "pln").rate).toEqual(4.5);

        const query = gql`
            query {
                currencyExchange(limit: 1000) {
                    items {
                        currency
                        date
                        rate
                    }
                }
            }
        `;
        const res3 = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        const currencies = res3.body.data.currencyExchange.items;

        expect(currencies.find(({currency}: any) => currency === "eur").rate).toEqual(1);
        expect(currencies.find(({currency}: any) => currency === "usd").rate).toEqual(expect.any(Number));
        expect(currencies.find(({currency}: any) => currency === "sek").rate).toEqual(expect.any(Number));
        expect(currencies.find(({currency}: any) => currency === "btc").rate).toEqual(expect.any(Number));
        expect(currencies.find(({currency}: any) => currency === "eth").rate).toEqual(expect.any(Number));
    });
});
