import Stats from "./Stats";
import {IWager} from "../IGame";
import * as wagerUtil from "../helper/wagerUtil";
import * as tickUtil from "../helper/tickUtil";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    totalWin: number;
    variance: number;
    filteredIterations: number;
}

export default class Variance<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    protected variance: number = 0;
    protected totalWin: number = 0;

    value() {
        return this.variance / this.filteredIterations;
    }

    message() {
        return this.value().toLocaleString(undefined, {maximumFractionDigits: 4}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.processWin(wagerUtil.sumOfWins(wagers) / wagerUtil.sumOfBets(wagers));
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.processWin(tickUtil.sumOfWins(ticks) / tickUtil.sumOfBets(ticks));
    }

    private processWin(win: number) {
        this.totalWin += win;
        const rtp = this.totalWin / this.filteredIterations;
        this.variance += Math.pow(win - rtp, 2);
    }

    mapResults() {
        return {totalWin: this.totalWin, variance: this.variance, filteredIterations: this.filteredIterations};
    }

    reduceResults(result: IMapReduceData) {
        this.totalWin += result.totalWin;
        this.variance += result.variance;
        this.filteredIterations += result.filteredIterations;
    }

    clearResults() {
        this.totalWin = 0;
        this.variance = 0;
        this.filteredIterations = 0;
    }
}
