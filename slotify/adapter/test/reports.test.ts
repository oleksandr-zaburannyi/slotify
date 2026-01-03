import {afterAll, beforeAll, describe, test} from "@jest/globals";
import {gql} from "graphql-request";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {Player} from "../db/model/Player";
import {Transaction} from "../db/model/Transaction";
import {v4} from "uuid";
import {Account} from "../db/model/Account";
import cube from "../route/cube";
import {TransactionCube} from "../db/model/TransactionCube";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {AuditLog} from "../db/model/AuditLog";
import {ReportExclusion} from "../db/model/ReportExclusion";
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

const createPlayer = async (data: Partial<Player> = {}) => {
    const player = Player.create({nativeId: Math.round(Math.random() * 1000000).toString(), currency: "eur", wallet: "demo", operator: "casino", ...data}) as Player;
    await player.save();
    const obj: any = {...player, createdAt: player.createdAt.getTime(), playerId: player.id, brand: null};
    delete obj.id;
    delete obj.updatedAt;
    delete obj.token;
    delete obj.blocked;
    return obj;
};

const createTransaction = async (data: Partial<Transaction> = {}, backwardFinished: boolean = false, status: string = "finished", backwardCancel: boolean = false) => {
    const roundId = v4();
    const transaction = Transaction.create({playerId: data.playerId, rgs: "test-rgs", type: "deposit", amount: 10, roundId, status, game: "test-game", auto: false, ...data}) as Transaction;
    if (backwardFinished) {
        transaction.finishedAt = new Date();
        transaction.finishedAt.setUTCDate(transaction.finishedAt.getUTCDate() - 1);
    }
    if (backwardCancel) {
        transaction.cancelledAt = new Date();
        transaction.cancelledAt.setUTCDate(transaction.cancelledAt.getUTCDate() - 1);
    }
    await transaction.save();
    const {wallet, brand, operator, nativeId, currency} = (await Player.findOneBy({id: data.playerId}))!;
    const obj: any = {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        name: null,
        brand,
        operator,
        nativeId,
        wallet,
        currency,
        transactionId: transaction.id,
        "replayUrl": "/launch/replay?rgs=test-rgs&provider=&roundId=" + roundId + "&game=test-game&wallet=" + wallet + "&operator=" + operator,
    };
    delete obj.id;
    delete obj.rgsTransactionId;
    delete obj.name;
    delete obj.updatedAt;
    delete obj.winRatio;
    delete obj.ip;
    delete obj.failReason;
    delete obj.data;
    delete obj.normalisedAmount;
    return obj;
};

const createReportExclusion = async (data: Partial<ReportExclusion> = {}) => {
    const exclusion = new ReportExclusion();
    Object.assign(exclusion, {
        playerId: null,
        nativeId: null,
        wallet: null,
        operator: null,
        brand: null,
        currency: null,
        startsAt: null,
        endsAt: null,
        comment: "test exclusion",
        ...data,
    });
    await exclusion.save();
    return exclusion;
};

const queryGameWin = async (options: any = {}) => {
    const query = gql`
        query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
            gameWin(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
                meta {
                    limit
                    offset
                    total
                    hasNext
                    hasPrev
                }
                items {
                    bets
                    wins
                    totalBet
                    totalWin
                    playerId
                    gameWin
                    rtp
                    currency
                    excluded
                }
            }
        }
    `;

    return await graphQlRequest(api, await accountToken(api), query, {
        options: {dimensions: ["playerId", "excluded"], ...options},
        limit: 10,
        sort: {field: "playerId", order: "ASC"},
        ...options,
    }).expect(200);
};

describe("reports", () => {
    test("players", async () => {
        const player1 = await createPlayer({currency: "eur", operator: "operator1"});
        const player2 = await createPlayer({currency: "eur", operator: "operator2"});
        const player3 = await createPlayer({currency: "eur", operator: "operator3"});
        const player4 = await createPlayer({currency: "sek", operator: "operator4"});
        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                players(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        playerId
                        nativeId
                        createdAt
                        currency
                        operator
                        brand
                        wallet
                        nickname
                        gender
                        country
                        jurisdiction
                    }
                }
            }
        `;
        //page 1
        const res = await graphQlRequest(api, await accountToken(api), query, {limit: 2, sort: {field: "createdAt", order: "ASC"}}).expect(200);
        expect(res.body.data).toEqual({players: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [player1, player2]}});

        //page 2
        const res2 = await graphQlRequest(api, await accountToken(api), query, {limit: 2, offset: 2, sort: {field: "createdAt", order: "ASC"}}).expect(200);
        expect(res2.body.data).toEqual({players: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [player3, player4]}});

        //search
        const res3 = await graphQlRequest(api, await accountToken(api), query, {filter: [{field: "currency", type: "EQUAL", value: "sek"}]}).expect(200);
        expect(res3.body.data).toEqual({players: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [player4]}});

        //permissions
        const account = await Account.create({email: "test1@operator.com", password: Account.hashPassword("pass"), operators: ["operator1", "operator3"], permissions: ["players"]}).save();
        const res4 = await graphQlRequest(api, await accountToken(api, account.email, "pass"), query, {sort: {field: "createdAt", order: "ASC"}}).expect(200);
        expect(res4.body.data).toEqual({players: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [player1, player3]}});

        await account.remove();
        await Player.clear();
    });

    test("transactions", async () => {
        const player1 = await createPlayer({currency: "eur", wallet: "w1", operator: "o1"});
        const player2 = await createPlayer({currency: "sek", wallet: "w1", operator: "o2"});
        const transaction1 = await createTransaction({playerId: player1.playerId});
        const transaction2 = await createTransaction({playerId: player1.playerId});
        const transaction3 = await createTransaction({playerId: player1.playerId});
        const transaction4 = await createTransaction({playerId: player2.playerId});
        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter]) {
                transactions(limit: $limit, sort: $sort, offset: $offset, filter: $filter) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        transactionId
                        createdAt
                        finishedAt
                        cancelledAt
                        type
                        amount
                        jackpotAmount
                        currency
                        roundId
                        status
                        game
                        variant
                        rgs
                        channel
                        roundFinished
                        provider
                        playerId
                        nativeId
                        category
                        campaignType
                        campaignId
                        balanceAfter
                        operator
                        brand
                        wallet
                        auto
                        replayUrl
                        regulatory
                    }
                }
            }
        `;
        //page 1
        const res = await graphQlRequest(api, await accountToken(api), query, {limit: 2, sort: {field: "createdAt", order: "ASC"}}).expect(200);
        expect(res.body.data).toEqual({transactions: {meta: {limit: 2, offset: 0, total: null, hasNext: true, hasPrev: false}, items: [transaction1, transaction2]}});

        //page 2
        const res2 = await graphQlRequest(api, await accountToken(api), query, {limit: 2, offset: 2, sort: {field: "createdAt", order: "ASC"}}).expect(200);
        expect(res2.body.data).toEqual({transactions: {meta: {limit: 2, offset: 2, total: null, hasNext: false, hasPrev: true}, items: [transaction3, transaction4]}});

        //search
        const res3 = await graphQlRequest(api, await accountToken(api), query, {filter: [{field: "currency", type: "EQUAL", value: "sek"}]}).expect(200);
        expect(res3.body.data).toEqual({transactions: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [transaction4]}});

        //permissions
        const account = await Account.create({email: "test2@operator.com", password: Account.hashPassword("pass"), wallets: ["w1", "w2"], operators: ["o2"], permissions: ["transactions"]}).save();
        const res4 = await graphQlRequest(api, await accountToken(api, account.email, "pass"), query, {sort: {field: "createdAt", order: "ASC"}}).expect(200);
        expect(res4.body.data).toEqual({transactions: {meta: {limit: 10, offset: 0, total: null, hasNext: false, hasPrev: false}, items: [transaction4]}});

        await account.remove();
        await Player.clear();
        await Transaction.clear();
    });

    test("gameWin", async () => {
        const player1 = await createPlayer({currency: "eur", wallet: "w1", operator: "o1"});
        const player2 = await createPlayer({currency: "sek", wallet: "w1", operator: "o2"});
        await createTransaction({playerId: player1.playerId, type: "withdraw", amount: 10}, true);
        await createTransaction({playerId: player1.playerId, type: "deposit", amount: 0}, true);
        await createTransaction({playerId: player2.playerId, type: "withdraw", amount: 10}, true);
        await createTransaction({playerId: player2.playerId, type: "deposit", amount: 50}, true);
        await createTransaction({playerId: player2.playerId, type: "withdraw", amount: 150}, false, "cancelled", true);
        await createTransaction({playerId: player2.playerId, type: "withdraw", amount: 10}, true, "cancelled", true);

        await new Promise(resolve => {
            cube(undefined, 0, () => resolve(true));
        });

        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
                gameWin(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
                    meta {
                        limit
                        offset
                        total
                        hasNext
                        hasPrev
                    }
                    items {
                        bets
                        wins
                        totalBet
                        totalWin
                        playerId
                        gameWin
                        rtp
                        currency
                    }
                }
            }
        `;
        // players' currencies
        const items = [
            {playerId: player1.playerId, gameWin: 10, bets: 1, wins: 1, totalBet: 10, totalWin: 0, rtp: 0, currency: player1.currency},
            {playerId: player2.playerId, gameWin: -40, bets: 1, wins: 1, totalBet: 10, totalWin: 50, rtp: 5, currency: player2.currency},
        ];
        const res = await graphQlRequest(api, await accountToken(api), query, {options: {dimensions: ["playerId"]}, limit: 2, sort: {field: "gameWin", order: "DESC"}}).expect(200);
        expect(res.body.data).toEqual({gameWin: {meta: {limit: 2, offset: 0, total: null, hasNext: false, hasPrev: false}, items}});

        const date = new Date();
        date.setHours(-49);
        const rate = 0.1;
        await CurrencyExchange.create({date, currency: "sek", rate}).save();
        await CurrencyExchange.create({date, currency: "eur", rate: 1}).save();

        // convert to base currency
        const items2 = [
            {playerId: player1.playerId, gameWin: 10, bets: 1, wins: 1, totalBet: 10, totalWin: 0, rtp: 0, currency: "eur"},
            {playerId: player2.playerId, gameWin: -40 / rate, bets: 1, wins: 1, totalBet: 10 / rate, totalWin: 50 / rate, rtp: 5, currency: "eur"},
        ];
        const res2 = await graphQlRequest(api, await accountToken(api), query, {limit: 2, sort: {field: "gameWin", order: "DESC"}, options: {convert: true, dimensions: ["playerId"]}}).expect(200);
        expect(res2.body.data).toEqual({gameWin: {meta: {limit: 2, offset: 0, total: null, hasNext: false, hasPrev: false}, items: items2}});

        //permissions
        const account = await Account.create({email: "test3@operator.com", password: Account.hashPassword("pass"), wallets: ["w1", "w2"], operators: ["o1"], permissions: ["gameWin"]}).save();
        const items3 = [{playerId: player1.playerId, gameWin: 10, bets: 1, wins: 1, totalBet: 10, totalWin: 0, rtp: 0, currency: player1.currency}];
        const res3 = await graphQlRequest(api, await accountToken(api, account.email, "pass"), query, {limit: 2, sort: {field: "gameWin", order: "DESC"}, options: {dimensions: ["playerId"]}}).expect(200);
        expect(res3.body.data).toEqual({gameWin: {meta: {limit: 2, offset: 0, total: null, hasNext: false, hasPrev: false}, items: items3}});

        await account.remove();
        await Player.clear();
        await Transaction.clear();
        await TransactionCube.clear();
    });

    describe("gameWin with report exclusions", () => {
        let player1: any, player2: any, player3: any, player4: any, player5: any;

        beforeAll(async () => {
            player1 = await createPlayer({currency: "eur", wallet: "w1", operator: "o1", nativeId: "user123", brand: "test-brand"});
            player2 = await createPlayer({currency: "sek", wallet: "w1", operator: "o2", nativeId: "user456"});
            player3 = await createPlayer({currency: "eur", wallet: "w2", operator: "o1", nativeId: "admin789", brand: "test-brand"});
            player4 = await createPlayer({currency: "usd", wallet: "w3", operator: "o3", nativeId: "test*user"});
            player5 = await createPlayer({currency: "eur", wallet: "w1", operator: "o1", nativeId: "premium_user", brand: "test-brand"});

            await createTransaction({playerId: player1.playerId, type: "withdraw", amount: 10}, true);
            await createTransaction({playerId: player1.playerId, type: "deposit", amount: 0}, true);
            await createTransaction({playerId: player2.playerId, type: "withdraw", amount: 10}, true);
            await createTransaction({playerId: player2.playerId, type: "deposit", amount: 50}, true);
            await createTransaction({playerId: player3.playerId, type: "withdraw", amount: 20}, true);
            await createTransaction({playerId: player3.playerId, type: "deposit", amount: 30}, true);
            await createTransaction({playerId: player4.playerId, type: "withdraw", amount: 15}, true);
            await createTransaction({playerId: player4.playerId, type: "deposit", amount: 25}, true);
            await createTransaction({playerId: player5.playerId, type: "withdraw", amount: 30}, true);
            await createTransaction({playerId: player5.playerId, type: "deposit", amount: 40}, true);

            await new Promise(resolve => {
                cube(undefined, 0, () => resolve(true));
            });
        });

        beforeEach(async () => {
            await ReportExclusion.clear();
        });

        test("no exclusions - all players should be included", async () => {
            const res = await queryGameWin();

            res.body.data.gameWin.items.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("exclude by exact playerId", async () => {
            await createReportExclusion({playerId: player1.playerId});

            const res = await queryGameWin();

            const player1Item = res.body.data.gameWin.items.find((item: any) => item.playerId === player1.playerId);
            expect(player1Item).toBeDefined();
            expect(player1Item.excluded).toBe(true);

            const otherPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId !== player1.playerId);
            otherPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("exclude by nativeId pattern", async () => {
            await createReportExclusion({nativeId: "user*"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId || item.playerId === player2.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId !== player1.playerId && item.playerId !== player2.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("exclude by wallet", async () => {
            await createReportExclusion({wallet: "w1"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId || item.playerId === player2.playerId || item.playerId === player5.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId !== player1.playerId && item.playerId !== player2.playerId && item.playerId !== player5.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("exclude by currency", async () => {
            await createReportExclusion({currency: "eur"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId || item.playerId === player3.playerId || item.playerId === player5.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId !== player1.playerId && item.playerId !== player3.playerId && item.playerId !== player5.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("exclude by operator", async () => {
            await createReportExclusion({operator: "o1"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId || item.playerId === player3.playerId || item.playerId === player5.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId !== player1.playerId && item.playerId !== player3.playerId && item.playerId !== player5.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("exclude by brand", async () => {
            await createReportExclusion({brand: "test-brand"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId || item.playerId === player3.playerId || item.playerId === player5.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId !== player1.playerId && item.playerId !== player3.playerId && item.playerId !== player5.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("date range exclusions", async () => {
            const res1 = await queryGameWin();

            res1.body.data.gameWin.items.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });

            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            await createReportExclusion({playerId: player1.playerId, startsAt: futureDate});

            const res2 = await queryGameWin();

            const player1Item = res2.body.data.gameWin.items.find((item: any) => item.playerId === player1.playerId);
            expect(player1Item.excluded).toBe(false);

            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 1);
            await createReportExclusion({playerId: player1.playerId, startsAt: pastDate});

            const res3 = await queryGameWin();

            const player1Item2 = res3.body.data.gameWin.items.find((item: any) => item.playerId === player1.playerId);
            expect(player1Item2.excluded).toBe(true);
        });

        test("multiple exclusion criteria", async () => {
            await createReportExclusion({playerId: player1.playerId});
            await createReportExclusion({nativeId: "admin*"});
            await createReportExclusion({wallet: "w3"});
            await createReportExclusion({operator: "o2"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId || item.playerId === player3.playerId || item.playerId === player4.playerId || item.playerId === player2.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player5.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("complex nativeId pattern", async () => {
            await createReportExclusion({nativeId: "test*user"});

            const res = await queryGameWin();

            const player4Item = res.body.data.gameWin.items.find((item: any) => item.playerId === player4.playerId);
            expect(player4Item).toBeDefined();
            expect(player4Item.excluded).toBe(true);

            const otherPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId !== player4.playerId);
            otherPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("combined multiple exclusion criteria", async () => {
            await createReportExclusion({nativeId: "user*", wallet: "w1", currency: "eur"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player2.playerId || item.playerId === player3.playerId || item.playerId === player4.playerId || item.playerId === player5.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("combined multiple exclusion criteria with operator and brand", async () => {
            await createReportExclusion({operator: "o1", brand: "test-brand", currency: "eur"});

            const res = await queryGameWin();

            const excludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player1.playerId || item.playerId === player3.playerId || item.playerId === player5.playerId);
            excludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(true);
            });

            const nonExcludedPlayers = res.body.data.gameWin.items.filter((item: any) => item.playerId === player2.playerId || item.playerId === player4.playerId);
            nonExcludedPlayers.forEach((item: any) => {
                expect(item.excluded).toBe(false);
            });
        });

        test("game win exclusion toggles with gameWin flag", async () => {
            await createReportExclusion({playerId: player1.playerId, gameWin: false});

            let res = await queryGameWin();
            let player1Item = res.body.data.gameWin.items.find((item: any) => item.playerId === player1.playerId);
            expect(player1Item?.excluded).toBe(false);

            await ReportExclusion.clear();

            await createReportExclusion({playerId: player1.playerId, gameWin: true});

            res = await queryGameWin();
            player1Item = res.body.data.gameWin.items.find((item: any) => item.playerId === player1.playerId);
            expect(player1Item?.excluded).toBe(true);
        });

        test("inspection exclusion toggles with inspection flag", async () => {
            await createReportExclusion({playerId: player1.playerId, inspection: false});

            let isExcluded = await ReportExclusion.isPlayerExcluded(player1.playerId);
            expect(isExcluded.excluded).toBe(false);

            await ReportExclusion.clear();

            await createReportExclusion({playerId: player1.playerId, inspection: true});

            isExcluded = await ReportExclusion.isPlayerExcluded(player1.playerId);
            expect(isExcluded.excluded).toBe(true);
        });

        test("combined exclusion flags", async () => {
            await createReportExclusion({playerId: player1.playerId, inspection: false, gameWin: false});

            let res = await queryGameWin();
            let player1Item = res.body.data.gameWin.items.find((item: any) => item.playerId === player1.playerId);
            expect(player1Item?.excluded).toBe(false);

            let inspectionExcluded = await ReportExclusion.isPlayerExcluded(player1.playerId);
            expect(inspectionExcluded.excluded).toBe(false);

            await ReportExclusion.clear();

            await createReportExclusion({playerId: player1.playerId, inspection: true, gameWin: true});

            res = await queryGameWin();
            player1Item = res.body.data.gameWin.items.find((item: any) => item.playerId === player1.playerId);
            expect(player1Item?.excluded).toBe(true);

            inspectionExcluded = await ReportExclusion.isPlayerExcluded(player1.playerId);
            expect(inspectionExcluded.excluded).toBe(true);

            await ReportExclusion.clear();
        });
    });

    test("auditLogs", async () => {
        await AuditLog.clear();

        const mutation = gql`
            mutation ($email: String!, $password: String!) {
                login(email: $email, password: $password) {
                    account {
                        email
                    }
                }
            }
        `;

        const nonExistingEmail = "non@existing.com";
        await graphQlRequest(api, "", mutation, {email: nonExistingEmail, password: "123"}).expect(200);

        const query = gql`
            query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
                auditLogs(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
                    meta {
                        limit
                        offset
                        total
                    }
                    items {
                        date
                        email
                        type
                        result
                        variables
                        action
                        success
                    }
                }
            }
        `;

        const items = [{date: expect.any(Number), email: nonExistingEmail, type: "mutation", action: "login", success: false, result: null, variables: null}];

        const res = await graphQlRequest(api, await accountToken(api), query, {
            limit: 1,
            sort: {field: "date", order: "DESC"},
            filter: [{field: "email", type: "EQUAL", value: nonExistingEmail}],
        }).expect(200);
        expect(res.body.data).toEqual({auditLogs: {meta: {limit: 1, offset: 0, total: null}, items}});
    });
});
