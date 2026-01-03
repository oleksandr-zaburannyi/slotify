import {calculateSampleStatistics, combineSamplesStatistics} from "./statistics";

describe("rtp statistics", () => {
    test.each(
        [
            [],
            [[]],
            [[1]],
            [[1, 2]],
            [[], []],
            [[1], []],
            [[], [2]],
            [[1], [0]],
            [[1, 2], []],
            [[], [2, 3]],
            [[1, 2], [3]],
            [[3], [1, 2]],
            [
                [0, 1],
                [0, 1],
            ],
            [
                [0, 1, 0],
                [1, 0, 1],
            ],
            [
                [0, 1, 0, 1, 0, 1],
                [1, 1, 0, 0],
            ],
            [
                [0, 1, 2],
                [3, 4, 5],
                [6, 7, 8],
            ],
            [[0, 1, 2], [3], [], [4, 5], [6, 7, 8]],
        ].map(entry => [JSON.stringify(entry), entry]),
    )("combine samples statistics - %s", (testName: string, sample: number[][]) => {
        const concatenatedSample = sample.reduce((concatenated, sample) => concatenated.concat(sample), []);
        const concatenatedSampleStatistics = calculateSampleStatistics(concatenatedSample)!;

        const samplesStatistics = sample.map(sample => calculateSampleStatistics(sample)!);
        const combinedStatistics = combineSamplesStatistics(samplesStatistics);

        expect(combinedStatistics.count).toEqual(concatenatedSampleStatistics.count);
        if (combinedStatistics.count === 0) {
            expect(combinedStatistics.mean).toBeUndefined();
        } else {
            expect(combinedStatistics.mean).toBeCloseTo(concatenatedSampleStatistics.mean!, 8);
        }

        if (combinedStatistics.count <= 1) {
            expect(combinedStatistics.variance).toBeUndefined();
        } else {
            expect(combinedStatistics.variance).toBeCloseTo(concatenatedSampleStatistics.variance!, 8);
        }
    });
});
