import Exception from "./Exception";
import countDecimals from "./countDecimals";

const MAX_DECIMAL_PRECISION = 11;

export function floor(value: number, decimal: number = 2): number {
    if (countDecimals(value) <= decimal) {
        return value;
    }

    let roundedValue = Math.round(value * Math.pow(10, MAX_DECIMAL_PRECISION));
    decimal = Math.max(0, Math.min(MAX_DECIMAL_PRECISION, decimal));
    let intDecimal = decimal - MAX_DECIMAL_PRECISION;
    if (roundedValue.toString().includes("e")) {
        const [base, power] = roundedValue.toString().split("e");
        roundedValue = Number(base);
        intDecimal += Number(power);
    }

    const result = Number(Math.floor((roundedValue + "e" + intDecimal) as any) + "e-" + decimal);

    if (Number.isNaN(result) || !Number.isFinite(result)) {
        throw new Exception(`Floor error - cannot calculate result for value ${value} with ${decimal} decimals`);
    }

    return result;
}
