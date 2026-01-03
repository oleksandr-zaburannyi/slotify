import Variance from "./Variance";
import {IWager} from "../IGame";
import {sumOfWins} from "../helper/wagerUtil";

interface IMapReduceData {
    totalWin: number;
    variance: number;
    filteredIterations: number;
    hits: number;
}

export default class RTPDampener<TData = any, TState = any> extends Variance<TData, TState> {
    protected hits: number = 0;
    static redraw = false;

    constructor(
        readonly name: string,
        readonly originalRtp: number,
        readonly targetRtp: number,
        readonly hitFrequency: number,
    ) {
        super();
    }

    processAllWagers(wagers: IWager<TData, TState, any>[]) {
        if (RTPDampener.redraw) {
            RTPDampener.redraw = false;
            if (wagers[0].win > 0) this.hits++;
            super.processAllWagers(wagers);
            return;
        }
        const round = 1000000;
        const threshold = Math.round(((this.targetRtp / this.originalRtp - this.hitFrequency) / (1 - this.hitFrequency)) * round) / round;

        if (sumOfWins(wagers) > 0 && Math.random() > threshold) {
            RTPDampener.redraw = true;
        } else {
            if (wagers[0].win > 0) this.hits++;
            super.processAllWagers(wagers);
        }
    }

    message() {
        const variance = this.variance / this.filteredIterations;
        const rtp = this.totalWin / this.filteredIterations;
        const hitFrequency = this.hits / this.filteredIterations;

        return `{name=${this.name}, rtp=${rtp.toFixed(3)}, hit frequency=${hitFrequency.toFixed(2)}, variance=${variance.toFixed(0)}, samples=${this.filteredIterations}}`;
    }

    mapResults() {
        return {hits: this.hits, ...super.mapResults()};
    }

    reduceResults(result: IMapReduceData) {
        this.hits += result.hits;
        super.reduceResults(result);
    }

    clearResults() {
        this.hits = 0;
        super.clearResults();
    }
}
