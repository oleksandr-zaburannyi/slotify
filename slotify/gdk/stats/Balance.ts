import Stats from "./Stats";
import {IWager} from "../IGame";
import * as wagerUtil from "../helper/wagerUtil";
import * as tickUtil from "../helper/tickUtil";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    balance: number;
}

export default class Balance<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    private balance: number = 0;

    value() {
        return this.balance;
    }

    message() {
        return this.value().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.balance += wagerUtil.sumOfWins(wagers) - wagerUtil.sumOfBets(wagers);
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.balance += tickUtil.sumOfWins(ticks) - tickUtil.sumOfBets(ticks);
    }

    mapResults() {
        return {balance: this.balance};
    }

    reduceResults(result: IMapReduceData) {
        this.balance += result.balance;
    }

    clearResults() {
        this.balance = 0;
    }
}
