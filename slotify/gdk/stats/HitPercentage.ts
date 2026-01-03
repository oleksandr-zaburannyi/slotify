import HitFrequency from "./HitFrequency";

export default class HitPercentage<TData = any, TState = any, TParams = any> extends HitFrequency<TData, TState, TParams> {
    value() {
        return this.hits / this.filteredIterations;
    }

    message() {
        return (this.value() * 100).toLocaleString(undefined, {maximumFractionDigits: 4}).replace(/,/g, " ") + "%";
    }
}
