import {IWager} from "../IGame";
import Stats from "./Stats";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    max: number;
}

export default class Max<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    private max: number = 0;
    private readonly valueFunction: (wagersOrTicks: any[]) => number;

    constructor(valueFunction: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => number) {
        super();
        this.valueFunction = valueFunction;
    }

    value() {
        return this.max;
    }

    message() {
        return this.value().toLocaleString(undefined, {maximumFractionDigits: 3}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.max = Math.max(this.max, this.valueFunction(wagers));
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.max = Math.max(this.max, this.valueFunction(ticks));
    }

    mapResults() {
        return {max: this.max};
    }

    reduceResults(result: IMapReduceData) {
        this.max = Math.max(this.max, result.max);
    }

    clearResults() {
        this.max = 0;
    }
}
