import {IWager} from "../IGame";
import Stats from "./Stats";
import median from "@slotify/shared/lib/median";
import {ITick} from "../IMultiplayerGame";

interface IMapReduceData {
    values: number[];
}

export default class Median<TData = any, TState = any, TParams = any> extends Stats<TData, TState, TParams> {
    private readonly valueFunction?: (wagersOrTicks: any) => number;
    protected values: number[] = [];

    constructor(valueFunction?: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => number) {
        super();
        this.valueFunction = valueFunction;
    }

    value() {
        return median(this.values);
    }

    message() {
        return this.value().toLocaleString(undefined, {maximumFractionDigits: 2}).replace(/,/g, " ");
    }

    protected processWagers(wagers: IWager<TData, TState, TParams>[]) {
        this.values.push(this.valueFunction!(wagers));
    }

    protected processTicks(ticks: ITick<TState, TParams>[]) {
        this.values.push(this.valueFunction!(ticks));
    }

    mapResults() {
        return {values: this.values};
    }

    reduceResults(result: IMapReduceData) {
        this.values.push(...result.values);
    }

    clearResults() {
        this.values = [];
    }
}
