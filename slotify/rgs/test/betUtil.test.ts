import {describe, expect, test} from "@jest/globals";
import {generateAvailable, getDefaultBet, getDefaultBetFromRange, getMaxBet, getMaxBonusBet, getMaxExposure, getMinBet, getRangeActionBets, IAvailableBets, IBetConfig, IBetsRange, isBetAvailable} from "../util/betUtil";

describe("betUtil", () => {
    const precisionNumbersMapper = (number: number, decimals: number = 8) => Number(number.toFixed(decimals));

    test.each(
        [
            [0, 1, 2],
            [0, 2, 4],
            [10, 200, 400],
            [0.1, 0.2],
            [0.01, 0.03],
        ].map((available: any, index: number) => [index, available]),
    )("isBetAvailable array positive case %d", (testName: string, available: number[]) => {
        available.forEach(bet => expect(isBetAvailable(available, 2, bet)).toEqual(true));
    });

    test.each(
        [
            [[0, 1, 2], 2.25],
            [[1, 2], 0],
            [[1, 3], 2],
            [[0.01, 0.02], 0],
            [[0.01, 0.03], 2],
            [[100, 200], 100.000000001],
            [[100, 200], 200.000000001],
            [[100, 200], 199.999999999],
        ].map(([available, bet]: any, index: number) => [index, available, bet]),
    )("isBetAvailable array negative case %d", (testName: string, available: IAvailableBets, bet: number) => {
        expect(isBetAvailable(available, 2, bet)).toEqual(false);
    });

    test.each(
        [
            {min: 0, max: 10, step: 0.01},
            {min: 0.05, max: 9.95, step: 0.1},
            {min: 0.05, max: 10, step: 0.1},
            {min: 0.05, max: 9.95, step: 0.1},
            {min: 1.33, max: 10, step: 0.3},
            {min: 1.33, max: 1.33, step: 0.33},
            {min: 0.75, max: 1.25, step: 0.5},
            {min: 0.75, max: 1.25, step: 0.25},
            {min: 0.75, max: 1.25, step: 0.1},
            {min: 0.75, max: 1.25, step: 0.05},
            {min: 0.75, max: 1.25, step: 0.01},
        ].map((available: any, index: number) => [index, available]),
    )("isBetAvailable range positive case %d", (testName: string, available: {min: number; max: number; step: number}) => {
        for (let bet = available.min; bet <= available.max; bet = precisionNumbersMapper(bet + available.step)) {
            expect(isBetAvailable(available, 2, bet)).toEqual(true);
        }
    });

    test.each(
        [
            [{min: 0, max: 10, step: 0.5}, 2.25],
            [{min: 0, max: 10, step: 0.5}, 0.1],
            [{min: 0, max: 10, step: 0.01}, 0.005],
            [{min: 0, max: 10, step: 0.01}, 5.001],
            [{min: 0, max: 10, step: 1}, 11],
            [{min: 1, max: 10, step: 1}, 0],
            [{min: 1, max: 10, step: 1}, 1 + 0.0000000001],
            [{min: 1, max: 10, step: 1}, 10 - 0.0000000001],
            [{min: 0.75, max: 1.25, step: 0.5}, 1],
            [{min: 0.75, max: 1.25, step: 0.24}, 1.25],
            [{min: 0.75, max: 1.25, step: 0.26}, 1.25],
        ].map(([available, bet]: any, index: number) => [index, available, bet]),
    )("isBetAvailable range negative case %d", (testName: string, available: IAvailableBets, bet: number) => {
        expect(isBetAvailable(available, 2, bet)).toEqual(false);
    });

    test("generateAvailable", () => {
        expect(generateAvailable([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
        expect(generateAvailable({min: 1, max: 2, step: 0.2}, 2, 1)).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2]);
    });

    test.each([
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {}, 1, 2, 0.1],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {minBet: 0}, 1, 2, 0], // session bet config always overrides settings
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {minBet: 0.2}, 1, 2, 0.2],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {}, 13.333333, 3, 1.333],
    ])("getMinBet(%s, %s, %s, %s) = %s", (baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number, expected: number | undefined) => {
        expect(getMinBet(baseCurrencyBetConfig, sessionBetConfig, rate, decimals)).toEqual(expected);
    });

    test.each([
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {}, 1, 2, 1000],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {maxBet: 10000}, 1, 2, 10000], // session bet config always overrides settings
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {maxBet: 20000}, 1, 2, 20000],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {}, 13.333333, 3, 13333.333],
    ])("getMaxBet(%s, %s, %s, %s) = %s", (baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number, expected: number | undefined) => {
        expect(getMaxBet(baseCurrencyBetConfig, sessionBetConfig, rate, decimals)).toEqual(expected);
    });

    test.each([
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000, defaultBet: 2}, {}, 1, 2, 2],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {}, 1, 2, undefined],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000, defaultBet: 2}, {}, 13.333333, 3, 26.667],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000, defaultBet: 2}, {defaultBet: 10}, 1, 2, 10],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {defaultBet: 10.777777}, 13.333333, 3, 10.778],
    ])("getDefaultBet(%s, %s, %s, %s) = %s", (baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number, expected: number | undefined) => {
        expect(getDefaultBet(baseCurrencyBetConfig, sessionBetConfig, rate, decimals)).toEqual(expected);
    });

    test.each([
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000, maxBonusBet: 2}, {}, 1, 2, 2],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {}, 1, 2, undefined],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000, maxBonusBet: 2}, {}, 13.333333, 3, 26.667],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {maxBonusBet: 10.777777}, 13.333333, 3, 10.778],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000, maxBonusBet: 2}, {maxBonusBet: 100}, 1, 2, 100], // session bet config always overrides settings
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000, maxBonusBet: 2}, {maxBonusBet: 5.555555}, 13.333333, 3, 5.556],
    ])("getMaxBonusBet(%s, %s, %s, %s) = %s", (baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number, expected: number | undefined) => {
        expect(getMaxBonusBet(baseCurrencyBetConfig, sessionBetConfig, rate, decimals)).toEqual(expected);
    });

    test.each([
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {}, 1, 2, 10000000],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000000}, {maxExposure: 100000}, 1, 2, 100000],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 1000}, {}, 13.333333, 3, 13333.333],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 10000}, {maxExposure: 10000}, 13.333333, 3, 10000],
        [{minBet: 0.1, maxBet: 1000, maxExposure: 100}, {maxExposure: 10000}, 13.333333, 3, 10000], // session bet config always overrides settings
    ])("getMaxExposure(%s, %s, %s, %s) = %s", (baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number, expected: number | undefined) => {
        expect(getMaxExposure(baseCurrencyBetConfig, sessionBetConfig, rate, decimals)).toEqual(expected);
    });

    test.each(
        [
            [{min: 0, max: 10, step: 0.01}, 1, 2, 1, 1],
            [{min: 0, max: 10, step: 0.01}, 1, 2, 7, 7],
            [{min: 0, max: 100, step: 0.1}, 1, 1, 10, 10],
            [{min: 0, max: 1000, step: 1}, 100, 0, 2, 200],
            [{min: 0, max: 1130, step: 113}, 113, 0, 2, 226],
            [{min: 0.5, max: 10.5, step: 1}, 1, 2, 5, 4.5],
            [{min: 0, max: 0.02, step: 0.01 * 0.00002}, 0.00002, 8, 2, 0.00004],
            [{min: 0, max: 0.02, step: 0.01 * 0.00002}, 0.00002, 8, 0.01, 0.0000002],
            [{min: 0, max: 0.02, step: 0.001 * 0.00002}, 0.00002, 8, 0.001, 0.00000002],
            [{min: 0, max: 0.02, step: 0.0001 * 0.00002}, 0.00002, 8, 0.0001, 0],
            [{min: 0, max: 0.02, step: 0.01 * 0.00002}, 0.00002, 8, 999, 0.01998],
            [{min: 0, max: 0.02, step: 0.01 * 0.00002}, 0.00002, 8, 1000, 0.02],
            [{min: 0, max: 0.02, step: 0.01 * 0.00002}, 0.00002, 8, 1001, 0.02],
            [{min: 0.000001, max: 0.02, step: 0.1 * 0.00002}, 0.00002, 8, 2, 0.000039],
        ].map((_: any, index: number) => [index, ..._]),
    )("findDefaultBetFromRange test case %d", (testName: string, available: IBetsRange, rate: number, decimals: number, defaultBet: number, expectedDefaultBet: number) => {
        expect(getDefaultBetFromRange(available, decimals, defaultBet * rate)).toEqual(expectedDefaultBet);
    });

    test("range action bets test 1", async () => {
        const gameAction = {available: {min: 0, max: 1000000, step: 0}, default: 2, coin: 1, maxWin: 1};
        const betLimits = {minBet: 5, maxBet: 500, maxExposure: 250000, currencyRate: 100, exchangeRate: 100, currencyDecimals: 2, currencyUnit: 0.01};
        const result = getRangeActionBets(gameAction, false, betLimits);
        expect(result).toEqual({available: {max: 500, min: 5, step: 0.01}, coin: 1, default: 200});
    });

    test("range action bets test 2", async () => {
        const gameAction = {available: {min: 0, max: 1000000, step: 0}, default: 2, coin: 1, maxWin: 1};
        const betLimits = {minBet: 0.0001, maxBet: 0.05, maxExposure: 3, currencyRate: 0.001, exchangeRate: 0.0001235, currencyDecimals: 4, currencyUnit: 0.0001};
        const result = getRangeActionBets(gameAction, false, betLimits);
        expect(result).toEqual({available: {max: 0.05, min: 0.0001, step: 0.0001}, coin: 1, default: 0.002});
    });

    test("range action bets overrode default bet", async () => {
        const gameAction = {available: {min: 0, max: 1000000, step: 0}, default: 2, coin: 1, maxWin: 1};
        const betLimits = {minBet: 5, maxBet: 20000, maxExposure: 250000, currencyRate: 100, exchangeRate: 100, currencyDecimals: 2, currencyUnit: 0.01, defaultBet: 100};
        const result = getRangeActionBets(gameAction, false, betLimits);
        expect(result).toEqual({available: {max: 20000, min: 5, step: 0.01}, coin: 1, default: 100});
    });
});
