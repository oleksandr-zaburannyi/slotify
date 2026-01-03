import Stats from "./Stats";
import {IWager} from "../IGame";
import * as wagerUtil from "../helper/wagerUtil";
import * as tickUtil from "../helper/tickUtil";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    win: number;
}

export default class TimesWin<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    private win: number = 0;

    value() {
        return this.win;
    }

    message() {
        return "x" + this.value().toLocaleString(undefined, {maximumFractionDigits: 1, minimumFractionDigits: 1}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.win = wagerUtil.sumOfWins(wagers) / wagerUtil.sumOfBets(wagers);
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.win = tickUtil.sumOfWins(ticks) / tickUtil.sumOfBets(ticks);
    }

    mapResults() {
        return {win: this.win};
    }

    reduceResults(result: IMapReduceData) {
        this.win = result.win;
    }

    clearResults() {
        this.win = 0;
    }
}
