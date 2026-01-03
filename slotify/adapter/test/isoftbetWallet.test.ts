import {afterAll, beforeAll, describe, jest, test} from "@jest/globals";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {Wallet} from "../db/model/Wallet";
import {Express} from "express";
import fetch, {Response} from "@slotify/shared/lib/fetch";
import * as request from "supertest";
import {URLSearchParams} from "url";
import * as crypto from "crypto";
import {Transaction} from "../db/model/Transaction";
import {Player} from "../db/model/Player";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import wait from "@slotify/shared/lib/wait";
import {Game} from "../db/model/Game";
import {Rgs} from "../db/model/Rgs";
import {Session} from "../db/model/Session";
import {gql} from "graphql-request";
import {normalizeWhitespaces} from "../util/gql";
import {v4} from "uuid";
import {cleanupAfterTests} from "./cleanup";

const walletConfig = {
    url: "https://isoftbet.wallet.com/api/test-provider",
    secretKey: "secret-key",
};

let api: Express;
const wallet = "isoftbet-wallet";

const rgsConfig = {
    secretKey: "secret-rgs-key",
    realUrl: "https://cdn.test-provider.tech/real?game=${game}&server=https://test-provider.tech&wallet=${wallet}&operator=${operator}&key=${key}",
    funUrl: "https://cdn.test-provider.tech/fun?game=${game}&server=https://test-provider.tech&operator=${operator}&wallet=demo",
    replayUrl: "https://cdn.test-provider.tech/replay?game=${game}&server=https://test-provider.tech&operator=${operator}&wallet=demo&roundId=${roundId}",
};

beforeAll(async () => {
    setEnvVariables();
    process.env.IS_PRODUCTION = "false";
    await createTestDatabase();
    await createConnections({test: {...dbOptions("adapter")}});
    await Wallet.create({id: wallet, adapter: "isoftbet", config: walletConfig}).save();
    await Rgs.create({id: "test-rgs", adapter: "standard", config: rgsConfig}).save();
    await Game.create({game: "test-game", provider: "test-provider", rgs: "test-rgs"}).save();
    await Game.create({game: "test-game2", provider: "test-provider", rgs: "test-rgs"}).save();
    await CurrencyExchange.create({currency: "sek", rate: 1, date: new Date()}).save();
    await CurrencyExchange.create({currency: "eur", rate: 1, date: new Date()}).save();
    api = await initService();
});
afterAll(async () => {
    await cleanupAfterTests();
});
jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("@slotify/shared/lib/fetch");
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const queueMockWalletResponse = (response: any): void => {
    mockedFetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(response)) as Response));
};

const hash = (string: string) => {
    return crypto.createHmac("sha256", walletConfig.secretKey).update(string).digest("hex");
};

afterEach(async () => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockedFetch.mockReset();

    await Player.clear();
    await Transaction.clear();
});

const standardRequest = {
    providergameid: "test-game",
    licenseeid: "123",
    operator: "casino",
    playerid: "xyz",
    username: "nickname",
    currency: "EUR",
    country: "UK",
    ISBskinid: "is",
    ISBgameid: "ig",
    extra: "abc",
    token: "xyz",
    state: "single",
};
const launch = async (customParams: any = {}) => {
    const params = {
        language: "en",
        providergameid: "test-game",
        lobbyurl: "https://lobby.com",
        licenseeid: 123,
        mode: "real",
        rci: 10,
        historyurl: "https://history.com",
        jurisdiction: "MT",
        operator: "casino",
        playerid: "xyz",
        username: "nickname",
        currency: "EUR",
        country: "UK",
        isbskinid: "is",
        isbgameid: "ig",
        extra: "abc",
        token: "xyz",
        ...customParams,
    };
    const response = await request(api).get("/wallet/isoftbet-wallet/launch").query(params).expect(302);
    const [baseUrl, paramsUrl] = response.headers.location.split("?");
    const launchParams = new URLSearchParams(paramsUrl);
    return {baseUrl, launchParams};
};

const authenticate = async (launchParams: any) => {
    queueMockWalletResponse({balance: 123, sessionid: "session-id"});
    const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
    return request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);
};

const header = (params: any, key: string = "secret-rgs-key") => {
    const body = params ? JSON.stringify(params) : "";
    const hmac = crypto.createHmac("sha256", key).update(body).digest("hex");
    return {"x-server-authorization": hmac};
};

describe("isoftbet wallet adapter", () => {
    test("launch demo", async () => {
        const {baseUrl, launchParams} = await launch({mode: "fun"});

        expect(baseUrl).toEqual("https://cdn.test-provider.tech/fun");
        expect(launchParams.get("game")).toEqual("test-game");
        expect(launchParams.get("provider")).toEqual("test-provider");
        expect(launchParams.get("lobbyUrl")).toEqual("https://lobby.com");
        expect(launchParams.get("language")).toEqual("en");
        expect(launchParams.get("operator")).toEqual("123");
    });

    test("launch real", async () => {
        const {baseUrl, launchParams} = await launch();

        expect(baseUrl).toEqual("https://cdn.test-provider.tech/real");
        expect(launchParams.get("provider")).toEqual("test-provider");
        expect(launchParams.get("game")).toEqual("test-game");
        expect(launchParams.get("lobbyUrl")).toEqual("https://lobby.com");
        expect(launchParams.get("language")).toEqual("en");
        expect(launchParams.get("operator")).toEqual("123");
        expect(launchParams.get("wallet")).toEqual("isoftbet-wallet");
        expect(launchParams.get("historyUrl")).toEqual("https://history.com");
        expect(launchParams.get("realityCheckInterval")).toEqual("10");
        expect(launchParams.get("key")).toEqual(expect.any(String));
    });

    test("authenticate", async () => {
        const {launchParams} = await launch();

        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({
            ...standardRequest,
            action: {command: "initsession"},
        });
        expect(body).toEqual({balance: 1.23, brand: "casino", country: "uk", currency: "eur", jurisdiction: "mt", nativeId: "123_xyz", nickname: "nickname", playerId: expect.any(String), sessionId: expect.any(String)});
    });

    test("authenticate with incorrect key", async () => {
        await launch();

        const params = {key: "incorrectkey", wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);

        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Incorrect authentication key"}});
    });
    test("authenticate with incorrect server key", async () => {
        await launch();

        const params = {key: "incorrectkey", wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header({})).send(params).expect(400);

        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Incorrect hmac signature"}});
    });

    test("authenticate with pending cancels", async () => {
        const player = await Player.create({wallet, nativeId: "123_xyz", currency: "eur", operator: "123"}).save();
        await Transaction.create({playerId: player.id, type: "withdraw", status: "cancel", amount: 10, roundId: "round-id", auto: false, provider: "test-provider", game: "test-game"}).save();
        const {launchParams} = await launch();

        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);

        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "The player has pending transaction with 'cancel' status"}});
    });

    test("authenticate with active session", async () => {
        const {launchParams} = await launch();

        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const params = {key: launchParams.get("key"), wallet, operator: "test", provider: "test-provider", game: "test-game"};
        await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        queueMockWalletResponse({});
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "end", parameters: {sessionstatus: "CLOSE"}},
        });
        expect(body).toEqual({balance: 1.23, brand: "casino", country: "uk", currency: "eur", jurisdiction: "mt", nativeId: "123_xyz", nickname: "nickname", playerId: expect.any(String), sessionId: expect.any(String)});
    });

    test("balance", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const params = {provider: "test-provider", game: "test-game", playerId: player!.id};
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const {body} = await request(api).get("/rgs/test-rgs/balance").set(header({})).query(params).expect(200);

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "balance"},
        });
        expect(body).toEqual({balance: 1.23});
    });

    test("bet and win", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();
        //bet
        const params1 = {playerId: player!.id, rgsTransactionId: "t1", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "bet", parameters: {amount: 123, roundid: params1.roundId, transactionid: expect.any(String)}},
        });
        expect(res1.body).toEqual({balance: 1.23});
        await wait(100);

        //win
        const params2 = {playerId: player!.id, rgsTransactionId: "t2", amount: 1.23, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(JSON.parse(mockedFetch.mock.calls[2][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "win", parameters: {amount: 123, roundid: params2.roundId, transactionid: expect.any(String), closeround: true}},
        });
        expect(res2.body).toEqual({balance: 1.23});
    });

    test("promo payout", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});

        const params1 = {playerId: player!.id, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "promo", type: "deposit", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "depositmoney", parameters: {amount: 123, transactionid: expect.any(String)}},
        });
        expect(res1.body).toEqual({balance: 1.23});
    });

    test("cancel", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const roundId = v4();

        //bet
        const params1 = {playerId: player!.id, rgsTransactionId: "t1", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);

        //cancel
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const params = {rgsTransactionId: "t1"};
        const {body} = await request(api).delete("/rgs/test-rgs/cancel").set(header(params)).send(params).expect(200);

        expect(JSON.parse(mockedFetch.mock.calls[2][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "cancel", parameters: {amount: 123, roundid: roundId, transactionid: expect.any(String)}},
        });
        expect(body).toEqual({balance: 1.23});
    });

    test("replay", async () => {
        const params = {command: "player_round_history", roundid: "r-id", providergameid: "test-game", language: "EN", licensee: 123};
        const response = await request(api)
            .get("/wallet/isoftbet-wallet/gsp")
            .query({...params, hash: hash(params.command + "," + params.roundid)})
            .expect(302);
        const [baseUrl, paramsUrl] = response.headers.location.split("?");
        const launchParams = new URLSearchParams(paramsUrl);

        expect(baseUrl).toEqual("https://cdn.test-provider.tech/replay");
        expect(launchParams.get("game")).toEqual("test-game");
        expect(launchParams.get("roundId")).toEqual(params.roundid);
        expect(launchParams.get("provider")).toEqual("test-provider");
        expect(launchParams.get("operator")).toEqual("123");
    });

    test("replay - wrong hash", async () => {
        const params = {command: "player_round_history", roundid: "r-id", providergameid: "test-game", language: "EN", licensee: 123};
        const response = await request(api)
            .get("/wallet/isoftbet-wallet/gsp")
            .query({...params, hash: hash("abc")})
            .expect(400);

        expect(response.body).toEqual({error: {code: "SERVER_UNAUTHORIZED", message: "Couldn't authorize the server"}});
    });

    test("force close round", async () => {
        const player = await Player.create({wallet, nativeId: "123_xyz", currency: "eur", operator: "123"}).save();
        const t1 = await Transaction.create({playerId: player.id, type: "withdraw", status: "cancel", amount: 10, roundId: "round-id1", auto: false, provider: "test-provider", game: "test-game"}).save();
        const t2 = await Transaction.create({playerId: player.id, type: "deposit", status: "failed", amount: 10, roundId: "round-id2", auto: false, provider: "test-provider", game: "test-game"}).save();

        const params = {command: "force_close_rounds", rounds: [{roundid: t1.roundId}, {roundid: t2.roundId}]};
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp")
            .query({hash: hash(JSON.stringify(params))})
            .send(params)
            .expect(200);
        expect(response.body).toEqual({"status": "success"});

        await t1.reload();
        await t2.reload();

        expect(t1.status).toEqual("cancelled");
        expect(t2.status).toEqual("finished");
    });

    test("force close round - wrong hash", async () => {
        const params = {command: "force_close_rounds", rounds: []};
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp")
            .query({hash: hash(JSON.stringify({}))})
            .send(params)
            .expect(400);
        expect(response.body).toEqual({error: {code: "SERVER_UNAUTHORIZED", message: "Couldn't authorize the server"}});
    });

    test("get coin values", async () => {
        await CurrencyExchange.insert({date: new Date(), currency: "EUR", rate: 1});
        const params = {command: "get_coin_values", providergameids: ["test-game", "test-game2"]};
        queueMockWalletResponse({data: {availableBets: {bets: {main: {available: [0.1, 2, 10]}}}}});
        queueMockWalletResponse({data: {availableBets: {bets: {main: {available: [0.2, 4]}}}}});
        const response = await request(api)
            .get("/wallet/isoftbet-wallet/gsp")
            .query({hash: hash(JSON.stringify(params))})
            .send(params)
            .expect(200);

        expect(response.body).toEqual({
            status: "success",
            licensees: {},
            games_setting: {
                "test-game": {"EUR": {default_coin: 10, coins: [10, 200, 1000]}},
                "test-game2": {"EUR": {default_coin: 20, coins: [20, 400]}},
            },
        });
    });

    test("get coin values- wrong hash", async () => {
        const params = {command: "get_coin_values", providergameids: ["p1.g1", "p2.g2"]};
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp")
            .query({hash: hash(JSON.stringify({}))})
            .send(params)
            .expect(400);
        expect(response.body).toEqual({error: {code: "SERVER_UNAUTHORIZED", message: "Couldn't authorize the server"}});
    });

    test("get critical files", async () => {
        const params = {command: "get_critical_files", providergameids: ["g1", "g2"]};
        queueMockWalletResponse({
            data: {
                criticalFiles: {
                    items: [
                        {component: "g1", jurisdictions: ["mt", "uk"], loggedChecksum: "abc", name: "file1"},
                        {component: "g2", jurisdictions: ["uk"], loggedChecksum: "abc", name: "file2"},
                    ],
                },
            },
        });
        const response = await request(api)
            .get("/wallet/isoftbet-wallet/gsp")
            .query({hash: hash(JSON.stringify(params))})
            .send(params)
            .expect(200);

        expect(response.body).toEqual({
            status: "success",
            critical_files: [
                {market: "MT", market_files: [{hash: "abc", name: "file1", providergameid: "g1", type: "file"}]},
                {
                    market: "UK",
                    market_files: [
                        {hash: "abc", name: "file1", providergameid: "g1", type: "file"},
                        {hash: "abc", name: "file2", providergameid: "g2", type: "file"},
                    ],
                },
            ],
        });
    });

    test("get critical files- wrong hash", async () => {
        const params = {command: "get_critical_files", providergameids: ["p1.g1", "p2.g2"]};
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp")
            .query({hash: hash(JSON.stringify({}))})
            .send(params)
            .expect(400);
        expect(response.body).toEqual({error: {code: "SERVER_UNAUTHORIZED", message: "Couldn't authorize the server"}});
    });

    test("end", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);

        queueMockWalletResponse({});
        const wallet = (await (jest.requireActual("../walletAdapter/walletAdapter") as any).getWalletAdapter("isoftbet-wallet")) as any;
        const player = await Player.findOneBy({});
        const session = await Session.findOneBy({});
        await wallet.end(player!, "expired", session!);

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "end", parameters: {"sessionstatus": "CLOSE"}},
        });
    });

    test("free rounds - bet and win", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});
        const campaignId = "campaign-id";
        const campaignType = "freeBets";
        const roundId = v4();

        //bet
        const params1 = {playerId: player!.id, rgsTransactionId: "t1", amount: 1.23, roundId, category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider", campaignId, campaignType};
        queueMockWalletResponse({data: {campaigns: {items: [{name: "isoftbet_123456"}]}}});
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const res1 = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        expect(JSON.parse(mockedFetch.mock.calls[2][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "bet", parameters: {freeroundid: 123456, amount: 123, roundid: params1.roundId, transactionid: expect.any(String)}},
        });
        expect(res1.body).toEqual({balance: 1.23});
        await wait(100);

        //win
        const params2 = {playerId: player!.id, rgsTransactionId: "t2", amount: 1.23, roundId, category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider", campaignId, campaignType};
        queueMockWalletResponse({data: {campaigns: {items: [{name: "isoftbet_123456"}]}}});
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const res2 = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(200);

        expect(JSON.parse(mockedFetch.mock.calls[4][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "win", parameters: {freeroundid: 123456, amount: 123, roundid: params2.roundId, transactionid: expect.any(String), closeround: true}},
        });
        expect(res2.body).toEqual({balance: 1.23});
    });

    test("free rounds - create", async () => {
        const params = {
            start_date: "2017-04-26 12:24:35",
            end_date: "2017-04-30 12:13:42",
            freeround_id: 1884,
            licensee_id: 134,
            limit_per_player: 11,
            operator: "Master Licensee",
            games_id: {"test-game": [{"coin_value": 25, "currency": "EUR"}]},
            "launchercode": "isb_134-qa",
        };
        queueMockWalletResponse({data: {addCampaign: true}});
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp/freerounds_create")
            .send({auth: {signature: hash(JSON.stringify(params))}, request: params})
            .expect(200);

        expect(response.body).toEqual({success: true, message: "Freeround package created successfully!"});

        const query = normalizeWhitespaces(gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `);

        const variables = {
            data: {
                config: {amount: 0.25, bets: 11, currency: "eur"},
                start: new Date(params.start_date).getTime(),
                end: new Date(params.end_date).getTime(),
                games: ["test-game"],
                providers: ["test-provider"],
                name: "isoftbet_1884",
                nativeIds: ["isoftbet-empty-player"],
                operators: ["134"],
                type: "freeBets",
                wallets: ["isoftbet-wallet"],
            },
        };
        expect(JSON.parse(mockedFetch.mock.calls[0][1]?.body as string)).toEqual({account: {}, query, variables});
    });

    test("free rounds - cancel", async () => {
        const params = {
            freeround_id: 1884,
        };
        const campaignId = "cid123";
        queueMockWalletResponse({data: {campaigns: {items: [{campaignId}]}}});
        queueMockWalletResponse({data: {editCampaign: true}});
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp/freerounds_cancel")
            .send({auth: {signature: hash(JSON.stringify(params))}, request: params})
            .expect(200);

        expect(response.body).toEqual({success: true, message: "Cancelled freeround successfully!"});

        const query = normalizeWhitespaces(gql`
            mutation ($campaignId: ID!, $data: CampaignInput!) {
                editCampaign(campaignId: $campaignId, data: $data)
            }
        `);
        const variables = {campaignId, data: {enabled: false}};

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({account: {}, query, variables});
    });

    test("free rounds - register players", async () => {
        const params = {
            freeround_id: 1884,
            player_ids: ["abc", "def"],
            licensee_id: 123,
        };
        const campaignId = "cid123";
        queueMockWalletResponse({data: {campaigns: {items: [{campaignId, nativeIds: ["isoftbet-empty-player"]}]}}});
        queueMockWalletResponse({data: {editCampaign: true}});
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp/players_register")
            .send({auth: {signature: hash(JSON.stringify(params))}, request: params})
            .expect(200);

        expect(response.body).toEqual({success: true, message: "Players registered successfully!"});

        const query = normalizeWhitespaces(gql`
            mutation ($campaignId: ID!, $data: CampaignInput!) {
                editCampaign(campaignId: $campaignId, data: $data)
            }
        `);
        const variables = {campaignId, data: {nativeIds: ["isoftbet-empty-player", "123_abc", "123_def"]}};

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({account: {}, query, variables});
    });

    test("free rounds - remove players", async () => {
        const params = {
            freeround_id: 1884,
            player_ids: ["abc"],
            licensee_id: 123,
        };
        const campaignId = "cid123";
        queueMockWalletResponse({data: {campaigns: {items: [{campaignId, nativeIds: ["isoftbet-empty-player", "123_abc", "123_def"]}]}}});
        queueMockWalletResponse({data: {editCampaign: true}});
        const response = await request(api)
            .post("/wallet/isoftbet-wallet/gsp/players_remove")
            .send({auth: {signature: hash(JSON.stringify(params))}, request: params})
            .expect(200);

        expect(response.body).toEqual({success: true, message: "Players removed successfully!"});

        const query = normalizeWhitespaces(gql`
            mutation ($campaignId: ID!, $data: CampaignInput!) {
                editCampaign(campaignId: $campaignId, data: $data)
            }
        `);
        const variables = {campaignId, data: {nativeIds: ["isoftbet-empty-player", "123_def"]}};

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({account: {}, query, variables});
    });

    test("error fetch - continue popup", async () => {
        const {launchParams} = await launch();
        queueMockWalletResponse({status: "error", message: "My error", display: true, action: "continue"});
        const params = {key: launchParams.get("key"), operator: "test", provider: "test-provider", game: "test-game", wallet: "isoftbet-wallet"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);

        expect(body).toEqual({error: {code: "UNKNOWN", message: "My error", popups: [{message: "My error", buttons: [{label: "continue", action: "close"}]}]}});
    });

    test("error fetch - void popup", async () => {
        const {launchParams} = await launch();
        queueMockWalletResponse({status: "error", message: "My error", display: true, action: "void"});
        const params = {key: launchParams.get("key"), operator: "test", provider: "test-provider", game: "test-game", wallet: "isoftbet-wallet"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);

        expect(body).toEqual({error: {code: "UNKNOWN", message: "My error", popups: [{message: "My error", buttons: [{label: "stop", action: "exit"}]}]}});
    });

    test("error fetch - buttons popup", async () => {
        const {launchParams} = await launch();
        queueMockWalletResponse({
            status: "error",
            message: "My error",
            display: true,
            action: "buttons",
            buttons: {
                buttons: [
                    {text: "a", action: "void"},
                    {text: "b", action: "continue"},
                    {text: "c", action: "history"},
                ],
            },
        });
        const params = {key: launchParams.get("key"), operator: "test", provider: "test-provider", game: "test-game", wallet: "isoftbet-wallet"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);

        expect(body).toEqual({
            error: {
                code: "UNKNOWN",
                message: "My error",
                popups: [
                    {
                        message: "My error",
                        buttons: [
                            {action: "exit", label: "a", preventClose: false},
                            {action: "close", label: "b", preventClose: false},
                            {action: "history", label: "c", preventClose: true},
                        ],
                    },
                ],
            },
        });
    });

    test("error fetch - known error", async () => {
        const {launchParams} = await launch();
        queueMockWalletResponse({code: "OT123", status: "error", message: "My error", display: false});
        const params = {key: launchParams.get("key"), operator: "test", provider: "test-provider", game: "test-game", wallet: "isoftbet-wallet"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);

        expect(body).toEqual({error: {code: "UNKNOWN", message: "My error", popups: [{buttons: [{action: "exit", label: "stop"}], message: "serverErrorMessage"}]}});
    });

    test("error fetch - known error", async () => {
        const {launchParams} = await launch();
        queueMockWalletResponse({code: "ER123", status: "error", message: "My error", display: false});
        const params = {key: launchParams.get("key"), operator: "test", provider: "test-provider", game: "test-game", wallet: "isoftbet-wallet"};
        const {body} = await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(400);

        expect(body).toEqual({error: {code: "UNKNOWN", message: "My error", popups: [{buttons: [{action: "exit", label: "stop"}], message: "serverErrorMessage"}]}});
    });

    test("error - repeat bet - end", async () => {
        const {launchParams} = await launch();
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        const params = {key: launchParams.get("key"), operator: "test", provider: "test-provider", game: "test-game", wallet: "isoftbet-wallet"};
        await request(api).post("/rgs/test-rgs/authenticate").set(header(params)).send(params).expect(200);

        const player = await Player.findOneBy({});
        const params1 = {playerId: player!.id, rgsTransactionId: "t1", amount: 1.23, roundId: v4(), category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        const {body} = await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(400);

        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "bet", parameters: {amount: 123, roundid: params1.roundId, transactionid: expect.any(String)}},
        });
        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual(JSON.parse(mockedFetch.mock.calls[2][1]?.body as string));
        expect(JSON.parse(mockedFetch.mock.calls[1][1]?.body as string)).toEqual(JSON.parse(mockedFetch.mock.calls[3][1]?.body as string));

        expect(JSON.parse(mockedFetch.mock.calls[4][1]?.body as string)).toEqual({
            ...standardRequest,
            sessionid: "session-id",
            action: {command: "end", parameters: {"sessionstatus": "ERROR"}},
        });
        expect(body).toEqual({error: {code: "UNKNOWN", message: "Couldn't fetch from wallet", popups: [{buttons: [{action: "exit", label: "stop"}], message: "serverErrorMessage"}]}});
    });

    test("skip auto deposit", async () => {
        const {launchParams} = await launch();
        await authenticate(launchParams);
        const player = await Player.findOneBy({});

        //bet
        const params1 = {playerId: player!.id, rgsTransactionId: "t1", amount: 1.23, roundId: "r", category: "normal", roundFinished: false, type: "withdraw", game: "test-game", provider: "test-provider"};
        queueMockWalletResponse({balance: 123, sessionid: "session-id"});
        await request(api).put("/rgs/test-rgs/transaction").set(header(params1)).send(params1).expect(200);
        await wait(100);

        //win
        const params2 = {playerId: player!.id, rgsTransactionId: "t2", amount: 1.23, roundId: "r", category: "normal", roundFinished: true, type: "deposit", game: "test-game", provider: "test-provider"};
        await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);

        const createdAt = new Date();
        createdAt.setHours(createdAt.getHours() - 24);
        await Transaction.createQueryBuilder().update(Transaction).set({createdAt}).execute();

        const {body} = await request(api).put("/rgs/test-rgs/transaction").set(header(params2)).send(params2).expect(400);
        expect(body).toEqual({error: {code: "APPLICATION_ERROR", message: "Transaction can't be repeated after 24 hours"}});
    });
});
