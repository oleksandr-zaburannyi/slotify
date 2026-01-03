import Stats from "./Stats";
import {IWager} from "../IGame";
import * as wagerUtil from "../helper/wagerUtil";
import * as tickUtil from "../helper/tickUtil";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    bets: number;
}

export default class TotalBet<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    private bets: number = 0;

    value() {
        return this.bets;
    }

    message() {
        return this.value().toLocaleString(undefined, {maximumFractionDigits: 3}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.bets += wagerUtil.sumOfBets(wagers);
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.bets += tickUtil.sumOfBets(ticks);
    }

    mapResults() {
        return {bets: this.bets};
    }

    reduceResults(result: IMapReduceData) {
        this.bets += result.bets;
    }

    clearResults() {
        this.bets = 0;
    }
}
