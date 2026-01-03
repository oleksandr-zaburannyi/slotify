import * as rng from "../lib";

jest.mock("../verify", () => ({
    verify: jest.requireActual("../verify").verify,
    setPeriodicVerification: jest.fn,
    setBackgroundCycling: jest.fn,
}));

describe("rng", () => {
    test("random", () => {
        for (let i = 0; i < 1000; i++) {
            const number = rng.random();
            expect(number).toBeGreaterThanOrEqual(0);
            expect(number).toBeLessThan(1);
        }
    });

    test("range", () => {
        for (let i = 0; i < 1000; i++) {
            const number = rng.randomInteger(5);
            expect(number).toBeGreaterThanOrEqual(0);
            expect(number).toBeLessThan(5);
            expect(Number.isInteger(number)).toEqual(true);
        }
    });
});
