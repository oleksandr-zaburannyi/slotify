import {IWager} from "../IGame";
import {ITick} from "../IMultiplayerGame";
import Stats from "./Stats";

interface IMapReduceData {
    hits: number;
    filteredIterations: number;
}

export default class HitCount<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams, IMapReduceData> {
    protected hits: number = 0;
    private readonly hitFunction: (wagersOrTicks: any) => boolean | number;

    constructor(hitFunction: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => boolean | number) {
        super();
        this.hitFunction = hitFunction;
    }

    processWagers(wagers: IWager<TData, TState, TParams>[]) {
        let hits = this.hitFunction(wagers);
        if (hits) {
            hits = typeof hits === "number" ? hits : 1;
            this.hits += hits;
        }
    }

    processTicks(ticks: ITick<TState, TParams>[]) {
        let hits = this.hitFunction(ticks);
        if (hits) {
            hits = typeof hits === "number" ? hits : 1;
            this.hits += hits;
        }
    }

    value() {
        return this.hits;
    }

    message() {
        return this.hits.toString();
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
