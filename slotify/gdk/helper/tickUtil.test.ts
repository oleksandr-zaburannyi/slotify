import {sumOfBets, sumOfWins} from "./tickUtil";

describe("tick util", () => {
    test("sumOfWins - tick", () => {
        expect(sumOfWins([])).toEqual(0);
        expect(sumOfWins([{wins: {a: 3, b: 2}}])).toEqual(5);
        expect(sumOfWins([{wins: {a: 3, b: 2}}, {wins: {a: 10}}])).toEqual(15);
    });

    test("sumOfBets - tick", () => {
        expect(sumOfBets([])).toEqual(0);
        expect(sumOfBets([{commands: [{commandId: "a", bet: undefined}]}])).toEqual(0);
        expect(
            sumOfBets([
                {
                    commands: [
                        {commandId: "a", bet: 3},
                        {commandId: "b", bet: 2},
                    ],
                },
            ]),
        ).toEqual(5);
        expect(
            sumOfBets([
                {commands: [{commandId: "a", bet: 5}]},
                {
                    commands: [
                        {commandId: "b", bet: 1},
                        {commandId: "c", bet: 9},
                    ],
                },
            ]),
        ).toEqual(15);

        expect(
            sumOfBets([
                {
                    cancels: ["a"],
                    commands: [
                        {commandId: "a", bet: 3},
                        {commandId: "b", bet: 2},
                    ],
                },
            ]),
        ).toEqual(2);
        expect(
            sumOfBets([
                {commands: [{commandId: "a", bet: 5}]},
                {
                    commands: [
                        {commandId: "b", bet: 1},
                        {commandId: "c", bet: 9},
                    ],
                    cancels: ["a", "b", "c"],
                },
            ]),
        ).toEqual(0);
    });
});
