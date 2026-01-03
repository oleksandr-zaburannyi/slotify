import * as rng from "../lib";

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));
jest.mock("../verify", () => ({verify: jest.requireActual("../verify").verify, setPeriodicVerification: jest.fn}));
jest.mock("../cycle", () => ({cycle: jest.requireActual("../cycle").cycle, setBackgroundCycling: jest.fn}));
jest.mock("../seed", () => ({seed: jest.requireActual("../seed").seed, setPeriodicReseeding: jest.fn}));

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
