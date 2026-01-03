import {IWager} from "../IGame";
import Stats from "./Stats";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    hits: number;
    filteredIterations: number;
}

export default class HitFrequency<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams, IMapReduceData> {
    protected hits: number = 0;
    private readonly hitFunction: (wagersOrTicks: any) => boolean;

    constructor(hitFunction: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => boolean) {
        super();
        this.hitFunction = hitFunction;
    }

    processWagers(wagers: IWager<TData, TState, TParams>[]) {
        if (this.hitFunction(wagers)) {
            this.hits++;
        }
    }

    processTicks(ticks: ITick<TState, TParams>[]) {
        if (this.hitFunction(ticks)) {
            this.hits++;
        }
    }

    value() {
        return this.filteredIterations / this.hits;
    }

    message() {
        return "1 in " + this.value().toLocaleString(undefined, {maximumFractionDigits: 4}).replace(/,/g, " ");
    }

    mapResults() {
        return {hits: this.hits, filteredIterations: this.filteredIterations};
    }

    reduceResults(result: IMapReduceData) {
        this.hits += result.hits;
        this.filteredIterations += result.filteredIterations;
    }

    clearResults() {
        this.hits = 0;
        this.filteredIterations = 0;
    }
}
