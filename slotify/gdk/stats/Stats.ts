import {IWager} from "../IGame";
import {ITick} from "../IMultiplayerGame";

export default abstract class Stats<TData = any, TState = any, TParams = any, TMapReduceData = any> {
    protected filteredIterations: number = 0;

    abstract value(): number;

    abstract message(): string;

    abstract reduceResults(result: TMapReduceData): void;

    abstract mapResults(): TMapReduceData;

    abstract clearResults(): void;

    processAllWagers(wagers: IWager<TData, TState, TParams>[]): void {
        if (this.filterFunction(wagers as any)) {
            this.filteredIterations++;
            this.processWagers(this.mapFunction(wagers as any));
        }
    }

    processAllTicks(ticks: ITick<TState, TParams>[]) {
        if (this.filterFunction(ticks as any)) {
            this.filteredIterations++;
            this.processTicks(this.mapFunction(ticks as any));
        }
    }

    filter(filterFunction: (wagers: IWager<TData, TState, TParams>[]) => boolean): Stats<TData, TState, TParams> {
        this.filterFunction = filterFunction;

        return this;
    }

    map(mapFunction: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]): Stats<TData, TState, TParams> {
        this.mapFunction = mapFunction;

        return this;
    }

    protected abstract processWagers(wagers: IWager<TData, TState, TParams>[]): void;

    protected abstract processTicks(ticks: ITick<TState, TParams>[]): void;

    private filterFunction: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => boolean = () => true;
    private mapFunction: (wagersOrTicks: (IWager<TData, TState, TParams> & ITick<TState, TParams>)[]) => (IWager<TData, TState, TParams> & ITick<TState, TParams>)[] = wagersOrTicks => wagersOrTicks;
}
