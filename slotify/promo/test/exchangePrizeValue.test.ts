import {describe, expect, jest, test} from "@jest/globals";
import exchangePrizeValue, {calculateSignificantDigits} from "../util/exchangePrizeValue";

jest.mock("@slotify/rng/verify", () => ({verify: (jest.requireActual("@slotify/rng/verify") as any).verify, setPeriodicVerification: jest.fn, setBackgroundCycling: jest.fn}));

describe("prizeDrop", () => {
    test.each([
        [1, [0, 0]],
        [2, [0, 0]],
        [9, [0, 0]],
        [19, [1, 0]],
        [999, [2, 0]],
        [990, [2, 1]],
        [1000000, [6, 6]],
        [1.9, [0, -1]],
        [0.01, [-2, -2]],
        [0.19, [-1, -2]],
        [1000000.01, [6, -2]],
    ])("calculate significant digits - %s -> %s", async (value, [magnitude, offset]) => {
        expect(calculateSignificantDigits(value)).toEqual([magnitude, offset]);
    });

    test.each([
        [1, 1, 1],
        [1, 2, 2],
        [3, 2, 6],
        [0.5, 2, 1],
        [0.5, 2.1, 1],
        [0.05, 2.2, 0.1],
        [0.01, 0.5, 0.01],
        [0.01, 100, 1],
        [0.01, 500, 5],
        [0.01, 549, 5.5],
        [1, 549, 550],
        [1, 549.4, 550],
        [1, 5.4, 5.5],
        [1000000, 0.000001, 1],
        [123456, 0.000001, 0.12],
        [123456, 0.000002, 0.25],
        [100, 4.749, 450],
        [100, 4.251, 450],
        [200, 4.749, 950],
        [200, 4.251, 850],
        [1500, 0.33, 500],
        [1500, 0.77, 1150],
    ])("fixed currency rate calculation - %s * %s = %s", async (prizeValue, currencyRate, expectedPrizeValue) => {
        expect(exchangePrizeValue(prizeValue, currencyRate)).toEqual(expectedPrizeValue);
    });
});
