import Stats from "./Stats";

interface IMapReduceData {
    filteredIterations: number;
}

export default class Iterations<T = any> extends Stats<T> {
    value() {
        return this.filteredIterations;
    }

    message() {
        return this.value().toLocaleString().replace(/,/g, " ");
    }

    protected processWagers() {}

    protected processTicks() {}

    mapResults() {
        return {filteredIterations: this.filteredIterations};
    }

    reduceResults(result: IMapReduceData) {
        this.filteredIterations += result.filteredIterations;
    }

    clearResults() {
        this.filteredIterations = 0;
    }
}
