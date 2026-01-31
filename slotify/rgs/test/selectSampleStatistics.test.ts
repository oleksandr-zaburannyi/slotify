import {afterAll, beforeAll, beforeEach, describe, test} from "@jest/globals";
import {selectSampleStatistics} from "../compliance/rtp/selectSampleStatistics";
import {closeDatabase, closeServer, createTestDatabase, initService} from "@slotify/shared/lib/testUtils";
import {Room} from "../db/model/Room";
import {Command} from "../db/model/Command";
import {DrawWin} from "../db/model/DrawWin";
import {v4 as uuid} from "uuid";
import {setEnvVariables} from "./setEnvVariables";
import {closeRedis} from "@slotify/shared/lib/redis";
import {stopScheduler} from "@slotify/shared/lib/scheduler";
import {stopIntervals} from "../util/metrics";
import {invalidate} from "@slotify/shared/lib/cache";
jest.mock("@slotify/shared/lib/fetch");
jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));

beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    await initService();
});

afterAll(async () => {
    await closeServer();
    await closeDatabase();
    await closeRedis();
    stopScheduler();
    stopIntervals();
});

describe("selectSampleStatistics - multiplayer support", () => {
    beforeEach(async () => {
        await DrawWin.clear();
        await Command.clear();
        await Room.clear();
        invalidate("rooms"); // Clear the Room cache between tests
    });

    describe("Multiplayer game detection", () => {
        test("should detect multiplayer game when room exists", async () => {
            const roomId = uuid();
            const game = "test-multiplayer-game";
            const variant = "default";

            // Create a multiplayer room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            const start = new Date("2024-01-01");
            const end = new Date("2024-01-02");

            // Should not throw and should handle empty data
            const result = await selectSampleStatistics(game, variant, start, end);
            expect(result.count).toBe(0);
            expect(result.mean).toBeUndefined();
            expect(result.variance).toBeUndefined();
        });

        test("should detect as multiplayer even when room is deleted", async () => {
            const roomId = uuid();
            const game = "test-game";
            const variant = "default";

            // Create a room and soft-delete it
            const room = await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            await Room.softRemove(room);

            const start = new Date("2024-01-01");
            const end = new Date("2024-01-02");

            // Should work (will use multiplayer logic even though room is deleted)
            const result = await selectSampleStatistics(game, variant, start, end);
            expect(result.count).toBe(0);
        });
    });

    describe("Multiplayer RTP calculation", () => {
        test("should calculate RTP correctly for multiplayer game with single round", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const drawId = uuid();
            const playerId = uuid();
            const roundId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Create command with bet
            await Command.create({
                commandId: uuid(),
                roomId,
                roundId,
                playerId,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Create draw win
            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId,
                drawId,
                tickId: 1,
                amount: 95,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            expect(result.count).toBe(1);
            expect(result.mean).toBeCloseTo(0.95, 8); // 95/100 = 0.95
            expect(result.variance).toBeUndefined(); // variance undefined for single sample
        });

        test("should calculate RTP correctly for multiple rounds", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const playerId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Create 3 rounds with different RTPs
            const roundData = [
                {bet: 100, win: 95}, // RTP: 0.95
                {bet: 200, win: 180}, // RTP: 0.90
                {bet: 150, win: 165}, // RTP: 1.10
            ];

            for (const [index, {bet, win}] of roundData.entries()) {
                const drawId = uuid();
                const roundId = uuid();

                await Command.create({
                    commandId: uuid(),
                    roomId,
                    roundId,
                    playerId,
                    drawId,
                    time: Date.now(),
                    action: "bet",
                    bet,
                    currency: "USD",
                    withdrawalStatus: "finished",
                    createdAt: new Date(`2024-01-01T12:${index}0:00Z`),
                }).save();

                await DrawWin.create({
                    drawWinId: uuid(),
                    playerId,
                    roundId,
                    drawId,
                    tickId: index + 1,
                    amount: win,
                    status: "finished",
                    createdAt: new Date(`2024-01-01T12:${index}0:00Z`),
                }).save();
            }

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            expect(result.count).toBe(3);
            // Mean should be average of [0.95, 0.90, 1.10] = 0.98333...
            expect(result.mean).toBeCloseTo(0.98333333, 6);
            expect(result.variance).toBeDefined();
            expect(result.variance).toBeGreaterThan(0);
        });

        test("should handle multiple players in same draw", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const drawId = uuid();
            const player1 = uuid();
            const player2 = uuid();
            const player1RoundId = uuid(); // Each player has their own round
            const player2RoundId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Player 1 bets 100
            await Command.create({
                commandId: uuid(),
                roomId,
                roundId: player1RoundId,
                playerId: player1,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Player 2 bets 200
            await Command.create({
                commandId: uuid(),
                roomId,
                roundId: player2RoundId,
                playerId: player2,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 200,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Player 1 wins 50
            await DrawWin.create({
                drawWinId: uuid(),
                playerId: player1,
                roundId: player1RoundId,
                drawId,
                tickId: 1,
                amount: 50,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Player 2 wins 250
            await DrawWin.create({
                drawWinId: uuid(),
                playerId: player2,
                roundId: player2RoundId,
                drawId,
                tickId: 1,
                amount: 250,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            // With per-round normalization: 2 rounds (one per player)
            expect(result.count).toBe(2);
            // Round 1: 50/100 = 0.5
            // Round 2: 250/200 = 1.25
            // Mean: (0.5 + 1.25) / 2 = 0.875
            expect(result.mean).toBeCloseTo(0.875, 8);
            expect(result.variance).toBeDefined();
        });

        test("should calculate RTP correctly for multiple rounds per draw", async () => {
            // This test verifies per-round normalization
            // Multiple rounds (players) in the same draw should each have their own RTP
            const roomId = uuid();
            const game = "test-multiplayer-asymmetric";
            const variant = "default";
            const drawId = uuid();
            const player1 = uuid();
            const player2 = uuid();
            const roundId1 = uuid();
            const roundId2 = uuid();

            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Two commands with different bets
            await Command.create({
                commandId: uuid(),
                roomId,
                roundId: roundId1,
                playerId: player1,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 50,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            await Command.create({
                commandId: uuid(),
                roomId,
                roundId: roundId2,
                playerId: player2,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 50,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Two wins with different amounts
            await DrawWin.create({
                drawWinId: uuid(),
                playerId: player1,
                roundId: roundId1,
                drawId,
                tickId: 1,
                amount: 50,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            await DrawWin.create({
                drawWinId: uuid(),
                playerId: player2,
                roundId: roundId2,
                drawId,
                tickId: 1,
                amount: 30,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            // With per-round normalization: 2 rounds
            expect(result.count).toBe(2);
            // Round 1: 50/50 = 1.0
            // Round 2: 30/50 = 0.6
            // Mean: (1.0 + 0.6) / 2 = 0.8
            expect(result.mean).toBeCloseTo(0.8, 8);
            expect(result.variance).toBeDefined();
        });
    });

    describe("Edge cases", () => {
        test("should exclude rounds with no commands", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const roundId = uuid();
            const drawId = uuid();
            const playerId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Create a DrawWin with no corresponding Command (orphaned win)
            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId,
                drawId,
                tickId: 1,
                amount: 100,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            // Should have no rounds (filtered because total_bet = 0)
            expect(result.count).toBe(0);
            expect(result.mean).toBeUndefined();
        });

        test("should handle rounds with commands but no wins (losing rounds)", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const drawId = uuid();
            const playerId = uuid();
            const roundId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Create command with bet
            await Command.create({
                commandId: uuid(),
                roomId,
                roundId,
                playerId,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Create DrawWin with amount 0 (player loses)
            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId,
                drawId,
                tickId: 1,
                amount: 0,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            expect(result.count).toBe(1);
            // RTP = 0/100 = 0
            expect(result.mean).toBe(0);
        });

        test("should exclude unfinished rounds", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const drawId = uuid();
            const playerId = uuid();
            const roundId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            await Command.create({
                commandId: uuid(),
                roomId,
                roundId,
                playerId,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Create unfinished DrawWin (status = "unpaid")
            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId,
                drawId,
                tickId: 1,
                amount: 95,
                status: "unpaid", // Not finished
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            expect(result.count).toBe(0);
        });

        test("should handle commands with NULL bet", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const drawId = uuid();
            const playerId = uuid();
            const roundId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Create command with valid bet
            await Command.create({
                commandId: uuid(),
                roomId,
                roundId,
                playerId,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            // Create command with NULL bet (should be excluded from aggregation)
            await Command.create({
                commandId: uuid(),
                roomId,
                roundId,
                playerId,
                drawId,
                time: Date.now(),
                action: "other-action",
                // bet is omitted (will be NULL in DB)
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId,
                drawId,
                tickId: 1,
                amount: 90,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            expect(result.count).toBe(1);
            // Should only count the command with bet=100
            expect(result.mean).toBeCloseTo(0.9, 8); // 90/100
        });

        test("should respect time period boundaries", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const variant = "default";
            const playerId = uuid();

            // Create room
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                variant,
                config: {},
                enabled: true,
            }).save();

            // Round before period
            const drawId1 = uuid();
            const roundId1 = uuid();

            await Command.create({
                commandId: uuid(),
                roomId,
                roundId: roundId1,
                playerId,
                drawId: drawId1,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2023-12-31T23:00:00Z"),
            }).save();

            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId: roundId1,
                drawId: drawId1,
                tickId: 1,
                amount: 50,
                status: "finished",
                createdAt: new Date("2023-12-31T23:00:00Z"), // Before start
            }).save();

            // Round in period
            const drawId2 = uuid();
            const roundId2 = uuid();

            await Command.create({
                commandId: uuid(),
                roomId,
                roundId: roundId2,
                playerId,
                drawId: drawId2,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId: roundId2,
                drawId: drawId2,
                tickId: 2,
                amount: 100,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"), // In period
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            const result = await selectSampleStatistics(game, variant, start, end);

            // Should only include the second round (filtered by DrawWin.createdAt)
            expect(result.count).toBe(1);
            expect(result.mean).toBeCloseTo(1.0, 8); // 100/100
        });

        test("should handle variant correctly (null vs undefined)", async () => {
            const roomId = uuid();
            const game = "test-multiplayer";
            const drawId = uuid();
            const playerId = uuid();
            const roundId = uuid();

            // Create room with null variant
            await Room.create({
                roomId,
                provider: "test-provider",
                game,
                // variant is omitted (will be NULL in DB)
                config: {},
                enabled: true,
            }).save();

            await Command.create({
                commandId: uuid(),
                roomId,
                roundId,
                playerId,
                drawId,
                time: Date.now(),
                action: "bet",
                bet: 100,
                currency: "USD",
                withdrawalStatus: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            await DrawWin.create({
                drawWinId: uuid(),
                playerId,
                roundId,
                drawId,
                tickId: 1,
                amount: 95,
                status: "finished",
                createdAt: new Date("2024-01-01T12:00:00Z"),
            }).save();

            const start = new Date("2024-01-01T00:00:00Z");
            const end = new Date("2024-01-02T00:00:00Z");

            // Query with undefined variant (should match null variant in DB)
            const result = await selectSampleStatistics(game, undefined, start, end);

            expect(result.count).toBe(1);
            expect(result.mean).toBeCloseTo(0.95, 8);
        });
    });
});
