import {setEnvVariables} from "./setEnvVariables";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {afterAll, beforeAll, describe, expect, jest, test} from "@jest/globals";
import {createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {v4} from "uuid";
import {IPrize} from "../util/ITool";
import {CampaignPrize} from "../db/model/CampaignPrize";
import {payPrizes, savePrizes} from "../util/prizes";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Campaign} from "../db/model/Campaign";
import {tools} from "../tools/tools";
import {testTool} from "./testTool";
import {cleanupAfterTests} from "./cleanup";

setEnvVariables();

jest.mock("@slotify/shared/lib/fetch");
jest.mock("@slotify/rng/lib/verify", () => ({verify: (jest.requireActual("@slotify/rng/lib/verify") as any).verify, setPeriodicVerification: jest.fn, setBackgroundCycling: jest.fn}));

const mockedFetchAndParse = fetchAndParse as jest.MockedFunction<typeof fetchAndParse>;

jest.mock("../util/routes", () => {
    const original: any = jest.requireActual("../util/routes");
    return {...original, startCheckingCampaigns: jest.fn()};
});

beforeAll(async () => {
    tools["test-tool"] = testTool;
    await createTestDatabase();
    await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

afterEach(async () => {
    jest.clearAllMocks();
    await CampaignPrize.clear();
    const campaigns = await Campaign.find({});
    for (const {campaignId} of campaigns) {
        await Campaign.deleteCascade(campaignId);
    }
});

describe("prizes", () => {
    test("item", async () => {
        const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool"});
        const playerId = v4();
        const prizes: IPrize[] = [{type: "item", playerId, data: {name: "my-item"}, comment: "my-comment"}];
        await savePrizes(getConnection("primary").manager, prizes, campaignId);

        const campaignPrizes = await CampaignPrize.find();
        expect(campaignPrizes).toEqual(prizes.map(prize => ({...prize, paid: false, campaignId, playerId, id: expect.any(Number), createdAt: expect.any(Date)})));

        mockedFetchAndParse.mockReturnValueOnce(Promise.resolve({balance: 123}));
        await payPrizes(campaignPrizes);
        const body = {
            rgsTransactionId: "prize_" + campaignPrizes[0].id,
            playerId,
            amount: 0,
            roundId: expect.any(String),
            category: "promo",
            roundFinished: true,
            type: "deposit",
            campaignType: "test-tool",
            campaignId,
            name: "test",
            campaignData: {name: "my-item"},
        };

        expect(mockedFetchAndParse.mock.calls[0][0]).toEqual("http://adapter:80/rgs/test-rgs/transaction");
        expect(JSON.parse(mockedFetchAndParse.mock.calls[0][1]?.body as string)).toEqual(body);
        expect(await CampaignPrize.findBy({})).toMatchObject(campaignPrizes.map(() => ({paid: true})));
    });

    test("cash", async () => {
        const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool"});
        const playerId = v4();
        const prizes: IPrize[] = [{type: "cash", playerId, data: {amount: 100, jackpotAmount: 10, currency: "sek"}, comment: "my-comment"}];
        await savePrizes(getConnection("primary").manager, prizes, campaignId);

        const campaignPrizes = await CampaignPrize.find();
        expect(campaignPrizes).toEqual(prizes.map(prize => ({...prize, paid: false, campaignId, playerId, id: expect.any(Number), createdAt: expect.any(Date)})));

        mockedFetchAndParse.mockReturnValueOnce(Promise.resolve({balance: 123}));
        await payPrizes(campaignPrizes);
        const body = {
            rgsTransactionId: "prize_" + campaignPrizes[0].id,
            playerId,
            amount: 100,
            jackpotAmount: 10,
            roundId: expect.any(String),
            category: "promo",
            roundFinished: true,
            type: "deposit",
            campaignType: "test-tool",
            campaignId,
            name: "test",
            campaignData: {
                amount: 100,
                currency: "sek",
                jackpotAmount: 10,
            },
        };

        expect(mockedFetchAndParse.mock.calls[0][0]).toEqual("http://adapter:80/rgs/test-rgs/transaction");
        expect(JSON.parse(mockedFetchAndParse.mock.calls[0][1]?.body as string)).toEqual(body);
        expect(await CampaignPrize.findBy({})).toMatchObject(campaignPrizes.map(() => ({paid: true})));
    });

    test("campaign", async () => {
        const {campaignId} = await Campaign.createWithState({name: "test", type: "test-tool"});
        const playerId = v4();
        const campaign = {
            type: "test-tool",
            name: "prize-campaign",
            config: {c: 123},
            playerIds: ["my-playerId"],
            games: ["my-game"],
            nativeIds: ["my-nativeId"],
            brands: ["my-brand"],
            operators: ["my-operator"],
            wallets: ["my-wallet"],
            providers: ["my-provider"],
        };
        const prizes: IPrize[] = [{type: "campaign", playerId, data: campaign, comment: "my-comment"}];
        await savePrizes(getConnection("primary").manager, prizes, campaignId);

        const campaignPrizes = await CampaignPrize.find();
        expect(campaignPrizes).toEqual(prizes.map(prize => ({...prize, paid: false, campaignId, playerId, id: expect.any(Number), createdAt: expect.any(Date)})));

        await payPrizes(campaignPrizes);
        expect(await Campaign.findOneBy({name: "prize-campaign"})).toMatchObject(campaign);
        expect(await CampaignPrize.findBy({})).toMatchObject(campaignPrizes.map(() => ({paid: true})));
    });
});
