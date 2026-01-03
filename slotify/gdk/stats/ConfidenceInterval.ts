import Variance from "./Variance";

type ConfidenceLevel = keyof typeof zValues;
const zValues = {
    80: 1.282,
    85: 1.44,
    90: 1.645,
    95: 1.96,
    99: 2.576,
    99.5: 2.807,
    99.9: 3.291,
};

export default class ConfidenceInterval<TData = any, TState = any, TParams = any> extends Variance<TData, TState, TParams> {
    protected confidenceLevels: ConfidenceLevel;

    constructor(confidence: ConfidenceLevel) {
        super();
        this.confidenceLevels = confidence;
    }

    value(): number {
        return (zValues[this.confidenceLevels] * Math.sqrt(super.value())) / Math.sqrt(this.filteredIterations);
    }

    message(): string {
        return `±${(this.value() * 100).toFixed(3)}%`;
    }
}
