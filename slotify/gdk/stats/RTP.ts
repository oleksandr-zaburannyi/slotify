import Stats from "./Stats";
import {IWager} from "../IGame";
import * as wagerUtil from "../helper/wagerUtil";
import * as tickUtil from "../helper/tickUtil";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    wins: number;
    bets: number;
}

export default class RTP<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    private readonly partialWinExtractor?: (wagersOrTicks: any) => number;
    private wins: number = 0;
    private bets: number = 0;

    constructor(partialWinExtractor?: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => number) {
        super();
        this.partialWinExtractor = partialWinExtractor;
    }

    value() {
        return (this.wins / this.bets) * 100;
    }

    message() {
        return this.value().toLocaleString(undefined, {maximumFractionDigits: 4}).replace(/,/g, " ") + "%";
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.wins += (this.partialWinExtractor || wagerUtil.sumOfWins)(wagers);
        this.bets += wagerUtil.sumOfBets(wagers);
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.wins += (this.partialWinExtractor || tickUtil.sumOfWins)(ticks);
        this.bets += tickUtil.sumOfBets(ticks);
    }

    mapResults() {
        return {wins: this.wins, bets: this.bets};
    }

    reduceResults(result: IMapReduceData) {
        this.wins += result.wins;
        this.bets += result.bets;
    }

    clearResults() {
        this.wins = 0;
        this.bets = 0;
    }
}
