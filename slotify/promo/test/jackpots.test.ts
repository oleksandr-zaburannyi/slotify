import {describe, test} from "@jest/globals";
import {accumulateJackpotPools} from "../tools/jackpots/jackpots";

function createEmptyStatistics(latestAccumulationData: any) {
    return Object.fromEntries(Object.keys(latestAccumulationData.poolAmounts).map(poolName => [poolName, {totalContribution: 0}]));
}

describe("jackpots", () => {
    test.each(
        [
            [
                "zero",
                {minor: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 0}},
                    pendingJackpotWins: {},
                },
                [{minor: {contribution: 0}}],
                {minor: {amount: 0}},
            ],
            [
                "contribute",
                {minor: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 0}},
                    pendingJackpotWins: {},
                },
                [{minor: {contribution: 1}}],
                {minor: {amount: 1}},
            ],
            [
                "contribute to positive pool amount",
                {minor: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 10}},
                    pendingJackpotWins: {},
                },
                [{minor: {contribution: 1}}],
                {minor: {amount: 11}},
            ],
            [
                "seed contribution",
                {minor: {reset: 0}},
                {
                    poolAmounts: {minor: {seedAmount: 1}},
                    pendingJackpotWins: {},
                },
                [{minor: {seedContribution: 0.1}}],
                {minor: {seedAmount: 1.1}},
            ],
            [
                "contribution and seed contribution",
                {minor: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 10, seedAmount: 1}},
                    pendingJackpotWins: {},
                },
                [{minor: {contribution: 1, seedContribution: 0.1}}],
                {minor: {amount: 11, seedAmount: 1.1}},
            ],
            [
                "multiple pools",
                {minor: {reset: 0}, major: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 10, seedAmount: 1}, major: {amount: 20, seedAmount: 2}},
                    pendingJackpotWins: {},
                },
                [{minor: {contribution: 1, seedContribution: 0.1}, major: {contribution: 2, seedContribution: 0.2}}],
                {minor: {amount: 11, seedAmount: 1.1}, major: {amount: 22, seedAmount: 2.2}},
            ],
            [
                "multiple entries",
                {minor: {reset: 0}, major: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 10, seedAmount: 1}, major: {amount: 20, seedAmount: 2}},
                    pendingJackpotWins: {},
                },
                [
                    {minor: {contribution: 1, seedContribution: 0.1}, major: {contribution: 2, seedContribution: 0.2}},
                    {minor: {contribution: 1, seedContribution: 0.1}, major: {contribution: 2, seedContribution: 0.2}},
                    {minor: {contribution: 1, seedContribution: 0.1}, major: {contribution: 2, seedContribution: 0.2}},
                ],
                {minor: {amount: 13, seedAmount: 1.3}, major: {amount: 26, seedAmount: 2.6}},
            ],
            [
                "negative entries (cancels) reduce the pool amount",
                {minor: {reset: 0}, major: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 0, seedAmount: 0}},
                    pendingJackpotWins: {},
                },
                [{minor: {contribution: -1, seedContribution: -0.1}}],
                {minor: {amount: -1, seedAmount: -0.1}},
            ],
            [
                "jackpot win",
                {minor: {reset: 0}, major: {reset: 0}},
                {
                    poolAmounts: {minor: {amount: 100, seedAmount: 10}},
                    pendingJackpotWins: {},
                },
                [{minor: {contribution: 1, seedContribution: 0.1, isJackpotWin: true}}],
                {minor: {amount: 10.1, seedAmount: 0}},
            ],
        ].map(([testName, config, latestAccumulationData, poolsChanges, expectedPoolAmounts]: any, index: number) => [
            index,
            testName,
            config,
            {...latestAccumulationData, poolStatistics: createEmptyStatistics(latestAccumulationData)},
            poolsChanges.map((poolsChange: any) => ({
                id: index,
                data: {
                    playerId: "player_" + index,
                    roundId: "round_" + index,
                    transactionId: "transaction_" + index,
                    poolsChange,
                },
            })),
            expectedPoolAmounts,
        ]),
    )("accumulate jackpot pools case %d: %s", (index: string, testName: string, config, latestAccumulationData, entries, expectedPoolAmounts) => {
        const {poolAmounts} = accumulateJackpotPools(config, latestAccumulationData, entries);
        Object.entries(poolAmounts).forEach(([poolName, poolData]) => {
            if (poolData.amount == null) {
                expect(expectedPoolAmounts[poolName].amount).toEqual(poolData.amount);
            } else {
                expect(poolData.amount).toBeCloseTo(expectedPoolAmounts[poolName].amount);
            }

            if (poolData.seedAmount == null) {
                expect(expectedPoolAmounts[poolName].seedAmount).toEqual(poolData.seedAmount);
            } else {
                expect(poolData.seedAmount).toBeCloseTo(expectedPoolAmounts[poolName].seedAmount);
            }
        });
    });
});
