import Median from "./Median";
import * as wagerUtil from "../helper/wagerUtil";
import * as tickUtil from "../helper/tickUtil";
import {IWager} from "../IGame";
import {ITick} from "../IMultiplayerGame";

export default class MedianWin<TData = any, TState = any, TParams = any> extends Median<TData, TState, TParams> {
    constructor() {
        super();
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.values.push(wagerUtil.sumOfWins(wagers) / wagerUtil.sumOfBets(wagers));
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.values.push(tickUtil.sumOfWins(ticks) / tickUtil.sumOfBets(ticks));
    }

    message() {
        return "x" + super.message();
    }
}
