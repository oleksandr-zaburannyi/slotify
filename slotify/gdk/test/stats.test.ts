import {describe, test} from "@jest/globals";
import Average from "../stats/Average";
import AverageWin from "../stats/AverageWin";
import Balance from "../stats/Balance";
import ConfidenceInterval from "../stats/ConfidenceInterval";
import HitFrequency from "../stats/HitFrequency";
import HitPercentage from "../stats/HitPercentage";
import Iterations from "../stats/Iterations";
import Max from "../stats/Max";
import MaxWin from "../stats/MaxWin";
import Median from "../stats/Median";
import MedianWin from "../stats/MedianWin";
import RTP from "../stats/RTP";
import RTPDampener from "../stats/RTPDampener";
import TimesWin from "../stats/TimesWin";
import Variance from "../stats/Variance";

jest.mock("@slotify/rng/lib/verify", () => ({verify: jest.requireActual("@slotify/rng/lib/verify").verify, setPeriodicVerification: jest.fn}));
jest.mock("@slotify/rng/lib/cycle", () => ({cycle: jest.requireActual("@slotify/rng/lib/cycle").cycle, setBackgroundCycling: jest.fn}));
jest.mock("@slotify/rng/lib/seed", () => ({seed: jest.requireActual("@slotify/rng/lib/seed").seed, setPeriodicReseeding: jest.fn}));

describe("stats", () => {
    test("average", async () => {
        const stats = new Average(wagers => wagers[0].win);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        const stats2 = new Average(wagers => wagers[0].win);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 2, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 3, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(1.5);
        expect(stats.message()).toEqual("1.5");
    });

    test("average win", async () => {
        const stats = new AverageWin();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        const stats2 = new AverageWin();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(1.5);
        expect(stats.message()).toEqual("x1.5");
    });

    test("balance", async () => {
        const stats = new Balance();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        const stats2 = new Balance();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(3);
        expect(stats.message()).toEqual("3.00");
    });

    test("confidence interval", async () => {
        const stats = new ConfidenceInterval(95);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2000, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 3000, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 5000, data: {}, bet: 1, action: "main"}]);

        const stats2 = new ConfidenceInterval(95);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(568.4166877073521);
        expect(stats.message()).toEqual("±56841.669%");
    });

    test("hit frequency", async () => {
        const stats = new HitFrequency(wagers => wagers[0].win > 0);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);

        const stats2 = new HitFrequency(wagers => wagers[0].win > 0);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(2);
        expect(stats.message()).toEqual("1 in 2");
    });

    test("hit percentage", async () => {
        const stats = new HitPercentage(wagers => wagers[0].win > 0);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);

        const stats2 = new HitPercentage(wagers => wagers[0].win > 0);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(0.5);
        expect(stats.message()).toEqual("50%");
    });

    test("iterations", async () => {
        const stats = new Iterations();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);

        const stats2 = new Iterations();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(4);
        expect(stats.message()).toEqual("4");
    });

    test("max", async () => {
        const stats = new Max(wagers => wagers[0].win);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);

        const stats2 = new Max(wagers => wagers[0].win);
        stats2.processAllWagers([{win: 1, data: {}, bet: 10, action: "main"}]);
        stats2.processAllWagers([{win: 10, data: {}, bet: 10, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(10);
        expect(stats.message()).toEqual("10");
    });

    test("max win", async () => {
        const stats = new MaxWin();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);

        const stats2 = new MaxWin();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 10, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(10);
        expect(stats.message()).toEqual("x10");
    });

    test("median", async () => {
        const stats = new Median(wagers => wagers[0].win);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 3, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 3, data: {}, bet: 1, action: "main"}]);

        const stats2 = new Median(wagers => wagers[0].win);
        stats2.processAllWagers([{win: 1, data: {}, bet: 10, action: "main"}]);
        stats2.processAllWagers([{win: 10, data: {}, bet: 10, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(3);
        expect(stats.message()).toEqual("3");
    });

    test("median win", async () => {
        const stats = new MedianWin();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 3, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 3, data: {}, bet: 1, action: "main"}]);

        const stats2 = new MedianWin();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 10, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(3);
        expect(stats.message()).toEqual("x3");
    });

    test("rtp", async () => {
        const stats = new RTP();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        const stats2 = new RTP();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(150);
        expect(stats.message()).toEqual("150%");
    });

    test("partial rtp", async () => {
        const stats = new RTP(wagers => wagers[0].data.paylinesWin);
        stats.processAllWagers([{win: 100, data: {paylinesWin: 75, scatterWin: 25}, bet: 25, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 10, data: {paylinesWin: 10, scatterWin: 0}, bet: 10, action: "main"}]);
        stats.processAllWagers([{win: 10, data: {paylinesWin: 5, scatterWin: 5}, bet: 5, action: "main"}]);

        const stats2 = new RTP(wagers => wagers[0].data.paylinesWin);
        stats2.processAllWagers([{win: 20, data: {paylinesWin: 10, scatterWin: 10}, bet: 5, action: "main"}]);
        stats2.processAllWagers([{win: 0, data: {paylinesWin: 0, scatterWin: 0}, bet: 5, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(100);
        expect(stats.message()).toEqual("100%");
    });

    test("rtp dampener", async () => {
        const stats = new RTPDampener("x", 1, 0.5, 0.5);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        const stats2 = new RTPDampener("x", 50, 100, 0.5);
        stats2.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.message()).toEqual("{name=x, rtp=0.667, hit frequency=0.33, variance=0, samples=3}");
    });

    test("times win", async () => {
        const stats = new TimesWin();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        const stats2 = new TimesWin();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 5, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(5);
        expect(stats.message()).toEqual("x5.0");
    });

    test("variance", async () => {
        const stats = new Variance();
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);
        stats.clearResults();
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        const stats2 = new Variance();
        stats2.processAllWagers([{win: 1, data: {}, bet: 1, action: "main"}]);
        stats2.processAllWagers([{win: 500, data: {}, bet: 1, action: "main"}]);

        stats.reduceResults(stats2.mapResults());

        expect(stats.value()).toEqual(15562.5625);
        expect(stats.message()).toEqual("15 562.5625");
    });

    test("filter", async () => {
        const stats = new Iterations().filter(wagers => wagers[0].win > 0);
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 200, data: {}, bet: 1, action: "main"}]);

        expect(stats.value()).toEqual(1);
    });

    test("map", async () => {
        const stats = new MaxWin().map(wagers => [{...wagers[0], win: 100}]);
        stats.processAllWagers([{win: 0, data: {}, bet: 1, action: "main"}]);
        stats.processAllWagers([{win: 2, data: {}, bet: 1, action: "main"}]);

        expect(stats.value()).toEqual(100);
    });
});
