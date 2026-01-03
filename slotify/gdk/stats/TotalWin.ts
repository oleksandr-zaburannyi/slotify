import Stats from "./Stats";
import {IWager} from "../IGame";
import * as wagerUtil from "../helper/wagerUtil";
import * as tickUtil from "../helper/tickUtil";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    wins: number;
}

export default class TotalWin<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    private readonly partialWinExtractor?: (wagersOrTicks: any) => number;
    private wins: number = 0;

    constructor(partialWinExtractor?: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => number) {
        super();
        this.partialWinExtractor = partialWinExtractor;
    }

    value() {
        return this.wins;
    }

    message() {
        return this.value().toLocaleString(undefined, {maximumFractionDigits: 3}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.wins += (this.partialWinExtractor || wagerUtil.sumOfWins)(wagers);
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.wins += (this.partialWinExtractor || tickUtil.sumOfWins)(ticks);
    }

    mapResults() {
        return {wins: this.wins};
    }

    reduceResults(result: IMapReduceData) {
        this.wins += result.wins;
    }

    clearResults() {
        this.wins = 0;
    }
}
