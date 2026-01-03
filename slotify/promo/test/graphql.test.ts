import {afterAll, afterEach, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {gql} from "graphql-request";
import {tools} from "../tools/tools";
import {testTool} from "./testTool";
import {Campaign} from "../db/model/Campaign";
import {PlayerState} from "../db/model/PlayerState";
import {v4} from "uuid";
import {CampaignPrize} from "../db/model/CampaignPrize";
import {CampaignLog} from "../db/model/CampaignLog";
import {cleanupAfterTests} from "./cleanup";
import {cleanupScheduledTasks} from "../util/scheduleTasks";

jest.mock("@slotify/rng/lib/verify", () => ({verify: (jest.requireActual("@slotify/rng/lib/verify") as any).verify, setPeriodicVerification: jest.fn, setBackgroundCycling: jest.fn}));
jest.mock("../util/routes", () => {
    const original: any = jest.requireActual("../util/routes");
    return {...original, startCheckingCampaigns: jest.fn()};
});
let api: Express;
beforeAll(async () => {
    tools["test-tool"] = testTool;
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

afterEach(async () => {
    jest.clearAllMocks();
    await cleanupScheduledTasks();
    const campaigns = await Campaign.find({});
    for (const {campaignId} of campaigns) {
        await Campaign.deleteCascade(campaignId);
    }
});

const createCampaign = async (data: Partial<Campaign> = {}) => {
    const campaign = await Campaign.createWithState({...data});
    await campaign.save();
    const obj: any = {...data};
    return obj;
};

const createCampaignPlayer = async (data: Partial<PlayerState> = {}, campaignData: Partial<Campaign> = {}) => {
    const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool", ...campaignData});
    const campaignPlayer = await PlayerState.create({campaignId, ...data}).save();
    await campaignPlayer.save();
    const obj: any = {...data, campaignId};
    return obj;
};

const createCampaignPrize = async (data: Partial<CampaignPrize> = {}, campaignData: Partial<Campaign> = {}) => {
    const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool", ...campaignData});
    const campaignPrize = await CampaignPrize.create({campaignId, ...data}).save();
    await campaignPrize.save();
    const obj: any = {...data, campaignId};
    return obj;
};

const createCampaignLog = async (data: Partial<CampaignLog> = {}, campaignData: Partial<Campaign> = {}) => {
    const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool", ...campaignData});
    const campaignLog = await CampaignLog.create({campaignId, ...data}).save();
    await campaignLog.save();
    const obj: any = {...data, campaignId};
    return obj;
};

describe("graphql", () => {
    test("system event", async () => {
        const config = {myConfig: "abc"};
        const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool", config});
        jest.spyOn(testTool, "systemEvent");
        const query = gql`
            mutation ($eventName: String!, $eventId: String!, $params: JSON, $campaignId: ID!) {
                campaignSystemEvent(eventName: $eventName, eventId: $eventId, params: $params, campaignId: $campaignId)
            }
        `;
        const res1 = await graphQlRequest(api, "", query, {campaignId, eventName: "my-event", eventId: "123", params: {myParams: 123}}, {}).expect(200);
        const res2 = await graphQlRequest(api, "", query, {campaignId, eventName: "my-event", eventId: "123", params: {myParams: 123}}, {}).expect(200);
        expect(res1.body).not.toHaveProperty("errors");
        expect(res2.body).toEqual(res1.body);
        expect(testTool.systemEvent).toHaveBeenCalledWith({eventName: "my-event", params: {myParams: 123}, config, loadCampaignState: expect.any(Function)});
        expect(testTool.systemEvent).toHaveBeenCalledTimes(1);
    });

    test("add campaign", async () => {
        const campaign: any = {
            name: "test",
            config: {},
            wallets: ["my-wallet"],
            brands: ["my-brand"],
            operators: ["my-operator"],
            games: ["my-game"],
            providers: ["my-provider"],
            playerIds: ["my-player"],
            nativeIds: ["my-native-id"],
        };
        jest.spyOn(testTool, "create");
        const query = gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `;
        const res = await graphQlRequest(api, "", query, {data: {...campaign, type: "test-tool"}}, {}).expect(200);

        expect(res.body).not.toHaveProperty("errors");
        const {campaignId} = (await Campaign.findOneBy({}))!;
        expect(res.body.data.addCampaign).toEqual(campaignId);
        expect(testTool.create).toHaveBeenCalledWith(campaign);
    });

    test("add campaign - no permissions", async () => {
        const campaign: any = {
            name: "test",
            config: {},
        };
        jest.spyOn(testTool, "create");
        const query = gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `;
        const account = {wallets: ["my-wallet"]};
        const res = await graphQlRequest(api, "", query, {data: {...campaign, type: "test-tool"}}, account).expect(200);

        expect(res.body).toHaveProperty("errors");
    });

    test("add campaign - has permissions", async () => {
        const campaign: any = {
            name: "test",
            config: {},
            wallets: ["my-wallet"],
        };
        jest.spyOn(testTool, "create");
        const query = gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `;
        const account = {wallets: ["my-wallet"]};
        const res = await graphQlRequest(api, "", query, {data: {...campaign, type: "test-tool"}}, account).expect(200);

        expect(res.body).not.toHaveProperty("errors");
    });

    test("edit campaign", async () => {
        const campaign: any = {
            name: "test",
            config: {},
            wallets: ["my-wallet"],
            brands: ["my-brand"],
            operators: ["my-operator"],
            games: ["my-game"],
            providers: ["my-provider"],
            playerIds: ["my-player"],
            nativeIds: ["my-native-id"],
            start: Date.now(),
            end: Date.now(),
        };
        const query = gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `;
        const res = await graphQlRequest(api, "", query, {data: {...campaign, type: "test-tool"}}, {}).expect(200);
        const campaignId = res.body.data.addCampaign;

        const previousCampaign = await Campaign.findOneBy({campaignId});

        jest.spyOn(testTool, "edit");
        const query2 = gql`
            mutation ($campaignId: ID!, $data: CampaignInput!) {
                editCampaign(campaignId: $campaignId, data: $data)
            }
        `;
        const res2 = await graphQlRequest(api, "", query2, {campaignId, data: {name: "new-name", end: 123456}}, {}).expect(200);

        expect(res2.body).not.toHaveProperty("errors");
        expect(testTool.edit).toHaveBeenCalledWith(previousCampaign, undefined, {...previousCampaign, name: "new-name", end: 123456});

        const editedCampaign = await Campaign.findOneBy({campaignId});

        expect(editedCampaign).toEqual({...previousCampaign, name: "new-name", end: new Date(123456), updatedAt: expect.any(Date)});
    });

    test("delete campaign", async () => {
        const campaign: any = {
            name: "test",
            config: {},
            wallets: ["my-wallet"],
            brands: ["my-brand"],
            operators: ["my-operator"],
            games: ["my-game"],
            providers: ["my-provider"],
            playerIds: ["my-player"],
            nativeIds: ["my-native-id"],
        };
        const query = gql`
            mutation ($data: CampaignInput!) {
                addCampaign(data: $data)
            }
        `;
        const res = await graphQlRequest(api, "", query, {data: {...campaign, type: "test-tool"}}, {}).expect(200);
        const campaignId = res.body.data.addCampaign;

        jest.spyOn(testTool, "create");
        const query2 = gql`
            mutation ($campaignId: ID!) {
                deleteCampaign(campaignId: $campaignId)
            }
        `;
        const res2 = await graphQlRequest(api, "", query2, {campaignId}, {}).expect(200);

        expect(res2.body).not.toHaveProperty("errors");
        expect(await Campaign.countBy({})).toEqual(0);
    });

    test("campaigns", async () => {
        const campaign1 = await createCampaign({name: "c1", type: "test-tool", operators: ["operator1"]});
        const campaign2 = await createCampaign({name: "c2", type: "test-tool", operators: ["operator2"]});
        const campaign3 = await createCampaign({name: "c3", type: "test-tool", operators: ["operator3"]});
        const campaign4 = await createCampaign({name: "c4", type: "test-tool", operators: ["operator4"]});
        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                campaigns(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        name
                        type
                        operators
                    }
                }
            }
        `;

        //page 1
        const res = await graphQlRequest(api, "", query, {limit: 2, sort: {field: "createdAt", order: "ASC"}}, {}).expect(200);
        expect(res.body.data).toEqual({campaigns: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [campaign1, campaign2]}});

        //page 2
        const res2 = await graphQlRequest(api, "", query, {limit: 2, offset: 2, sort: {field: "createdAt", order: "ASC"}}, {}).expect(200);
        expect(res2.body.data).toEqual({campaigns: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [campaign3, campaign4]}});

        //permissions
        const account = {operators: ["operator2", "operator3"]};
        const res4 = await graphQlRequest(api, "", query, {sort: {field: "createdAt", order: "ASC"}}, account).expect(200);
        expect(res4.body.data).toEqual({campaigns: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [campaign2, campaign3]}});
    });

    test("campaignsPlayers", async () => {
        const campaign1 = await createCampaignPlayer({playerId: v4()}, {name: "c1", operators: ["operator1"]});
        const campaign2 = await createCampaignPlayer({playerId: v4()}, {name: "c2", operators: ["operator2"]});
        const campaign3 = await createCampaignPlayer({playerId: v4()}, {name: "c3", operators: ["operator3"]});
        const campaign4 = await createCampaignPlayer({playerId: v4()}, {name: "c4", operators: ["operator4"]});
        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                campaignPlayers(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        playerId
                        campaignId
                    }
                }
            }
        `;

        //page 1
        const res = await graphQlRequest(api, "", query, {limit: 2, sort: {field: "updatedAt", order: "ASC"}}, {}).expect(200);
        expect(res.body.data).toEqual({campaignPlayers: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [campaign1, campaign2]}});

        //page 2
        const res2 = await graphQlRequest(api, "", query, {limit: 2, offset: 2, sort: {field: "updatedAt", order: "ASC"}}, {}).expect(200);
        expect(res2.body.data).toEqual({campaignPlayers: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [campaign3, campaign4]}});

        //permissions
        const account = {operators: ["operator2", "operator3"]};
        const res4 = await graphQlRequest(api, "", query, {sort: {field: "updatedAt", order: "ASC"}}, account).expect(200);
        expect(res4.body.data).toEqual({campaignPlayers: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [campaign2, campaign3]}});
    });

    test("campaignsPrizes", async () => {
        const campaign1 = await createCampaignPrize({type: "item", data: {}, paid: false, playerId: v4()}, {name: "c1", operators: ["operator1"]});
        const campaign2 = await createCampaignPrize({type: "item", data: {}, paid: false, playerId: v4()}, {name: "c2", operators: ["operator2"]});
        const campaign3 = await createCampaignPrize({type: "item", data: {}, paid: false, playerId: v4()}, {name: "c3", operators: ["operator3"]});
        const campaign4 = await createCampaignPrize({type: "item", data: {}, paid: false, playerId: v4()}, {name: "c4", operators: ["operator4"]});
        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                campaignPrizes(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        playerId
                        campaignId
                        data
                        paid
                        type
                    }
                }
            }
        `;

        //page 1
        const res = await graphQlRequest(api, "", query, {limit: 2, sort: {field: "createdAt", order: "ASC"}}, {}).expect(200);
        expect(res.body.data).toEqual({campaignPrizes: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [campaign1, campaign2]}});

        //page 2
        const res2 = await graphQlRequest(api, "", query, {limit: 2, offset: 2, sort: {field: "createdAt", order: "ASC"}}, {}).expect(200);
        expect(res2.body.data).toEqual({campaignPrizes: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [campaign3, campaign4]}});

        //permissions
        const account = {operators: ["operator2", "operator3"]};
        const res4 = await graphQlRequest(api, "", query, {sort: {field: "createdAt", order: "ASC"}}, account).expect(200);
        expect(res4.body.data).toEqual({campaignPrizes: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [campaign2, campaign3]}});
    });

    test("campaignsLogs", async () => {
        const campaign1 = await createCampaignLog({name: "item", data: {}}, {name: "c1", operators: ["operator1"]});
        const campaign2 = await createCampaignLog({name: "item", data: {}}, {name: "c2", operators: ["operator2"]});
        const campaign3 = await createCampaignLog({name: "item", data: {}}, {name: "c3", operators: ["operator3"]});
        const campaign4 = await createCampaignLog({name: "item", data: {}}, {name: "c4", operators: ["operator4"]});
        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                campaignLogs(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        campaignId
                        data
                        name
                        data
                    }
                }
            }
        `;

        //page 1
        const res = await graphQlRequest(api, "", query, {limit: 2, sort: {field: "createdAt", order: "ASC"}}, {}).expect(200);
        expect(res.body.data).toEqual({campaignLogs: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [campaign1, campaign2]}});

        //page 2
        const res2 = await graphQlRequest(api, "", query, {limit: 2, offset: 2, sort: {field: "createdAt", order: "ASC"}}, {}).expect(200);
        expect(res2.body.data).toEqual({campaignLogs: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [campaign3, campaign4]}});

        //permissions
        const account = {operators: ["operator2", "operator3"]};
        const res4 = await graphQlRequest(api, "", query, {sort: {field: "createdAt", order: "ASC"}}, account).expect(200);
        expect(res4.body.data).toEqual({campaignLogs: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [campaign2, campaign3]}});
    });
});
