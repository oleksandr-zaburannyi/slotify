import {IWager} from "../IGame";
import Stats from "./Stats";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    total: number;
    filteredIterations: number;
}

export default class Average<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    protected total: number = 0;
    private readonly valueFunction?: (wagersOrTicks: any) => number;

    constructor(valueFunction?: (wagersOrTicks: (IWager<TData, TState> & ITick<TState, TParams>)[]) => number) {
        super();
        this.valueFunction = valueFunction;
    }

    value() {
        return this.total / this.filteredIterations;
    }

    message() {
        return this.value().toLocaleString(undefined, {maximumFractionDigits: 2}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.total += this.valueFunction!(wagers);
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.total += this.valueFunction!(ticks);
    }

    mapResults(): IMapReduceData {
        return {total: this.total, filteredIterations: this.filteredIterations};
    }

    reduceResults(result: IMapReduceData): void {
        this.total += result.total;
        this.filteredIterations += result.filteredIterations;
    }

    clearResults() {
        this.total = 0;
        this.filteredIterations = 0;
    }
}
