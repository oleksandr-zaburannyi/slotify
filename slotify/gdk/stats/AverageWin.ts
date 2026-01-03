import Average from "./Average";
import * as wagerUtil from "../helper/wagerUtil";
import {IWager} from "../IGame";
import * as tickUtil from "../helper/tickUtil";
import {ITick} from "../IMultiplayerGame";

export default class AverageWin<TData = any, TState = any, TParams = any> extends Average<TData, TState, TParams> {
    constructor() {
        super();
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.total += wagerUtil.sumOfWins(wagers) / wagerUtil.sumOfBets(wagers);
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.total += tickUtil.sumOfWins(ticks) / tickUtil.sumOfBets(ticks);
    }

    message() {
        return "x" + super.message();
    }
}
