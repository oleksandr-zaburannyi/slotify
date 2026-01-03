import {sumOfBets, sumOfWins} from "./wagerUtil";

describe("wager util", () => {
    test("sumOfWins - wagers", () => {
        expect(sumOfWins([])).toEqual(0);
        expect(sumOfWins([{win: 5}])).toEqual(5);
        expect(sumOfWins([{win: 5}, {win: 10}])).toEqual(15);
    });

    test("sumOfBets - wagers", () => {
        expect(sumOfBets([])).toEqual(0);
        expect(sumOfBets([{bet: 1, sideBet: 4}])).toEqual(5);
        expect(
            sumOfBets([
                {bet: 1, sideBet: 4},
                {bet: 1, sideBet: 10},
            ]),
        ).toEqual(15);
    });
});
