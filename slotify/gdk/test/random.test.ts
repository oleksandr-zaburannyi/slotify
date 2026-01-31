import {describe, test} from "@jest/globals";
import {createMemorisingRandom, createRandom, createRiggedRandom} from "@slotify/rng/lib/random/factory";

jest.mock("@slotify/rng/lib/verify", () => ({verify: jest.requireActual("@slotify/rng/lib/verify").verify, setPeriodicVerification: jest.fn}));
jest.mock("@slotify/rng/lib/cycle", () => ({cycle: jest.requireActual("@slotify/rng/lib/cycle").cycle, setBackgroundCycling: jest.fn}));
jest.mock("@slotify/rng/lib/seed", () => ({seed: jest.requireActual("@slotify/rng/lib/seed").seed, setPeriodicReseeding: jest.fn}));

describe("random", () => {
    test("random number is 32-bit range", () => {
        const random = createRandom();
        const randomNumber = random();
        expect(Number.isInteger(randomNumber)).toBeTruthy();
        expect(randomNumber).toBeLessThan(2 ** 32);
        expect(randomNumber).toBeGreaterThanOrEqual(0);
    });

    test("random number is limited", () => {
        const random = createRandom();
        expect(random(1)).toBeLessThan(1);
        expect(random(2)).toBeLessThan(2);
        expect(random(100)).toBeLessThan(100);
        expect(random(2 ** 32)).toBeLessThan(2 ** 32);
    });

    test("throws exception for non positive limits", () => {
        const random = createRandom();
        expect(() => random(-1)).toThrow("Random function limit must be positive");
        expect(() => random(0)).toThrow("Random function limit must be positive");
    });

    test("throws exception for non integer limits", () => {
        const random = createRandom();
        expect(() => random(2.5)).toThrow("Random function limit must be an integer");
    });

    test("throws exception for out of 32-bit range limits", () => {
        const random = createRandom();
        expect(() => random(2 ** 32 + 1)).toThrow("Random function limit cannot exceed 32-bit range (not greater than 2**32 = 4294967296)");
    });

    test("rigged random follows input sequence", () => {
        const random = createRiggedRandom([0, 1, 2]);
        expect(random()).toEqual(0);
        expect(random()).toEqual(1);
        expect(random()).toEqual(2);
    });

    test("rigged random notifies about limits malfunction", () => {
        const random = createRiggedRandom([3]);
        expect(() => random(2)).toThrow("Cheated random number exceeds limit requested by the game");
    });

    test("rigged random falls back to regular rng after depleting the input sequence", () => {
        const random = createRiggedRandom([2]);
        expect(random(3)).toEqual(2);
        expect(random(2)).toBeLessThan(2);
    });

    test("memorising random fills the numbers buffer", () => {
        const buffer: number[] = [];
        const random = createMemorisingRandom(buffer);
        expect([random(5), random()]).toEqual(buffer);
    });
});
