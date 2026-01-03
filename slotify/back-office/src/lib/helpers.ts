import env from "./env";

export function capitalize(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function lowercase(string: string): string {
    return string.toLowerCase();
}

function toCamelCase(str: string): string {
    return str
        .toLowerCase()
        .replace(/[-_]+/g, " ")
        .replace(/[^\w\s]/g, "")
        .replace(/ (.)/g, function ($1) {
            return $1.toUpperCase();
        })
        .replace(/ /g, "");
}

export function objectToCamelCase(origObj: any): any {
    return Object.keys(origObj).reduce(function (newObj: any, key) {
        const val = origObj[key];
        newObj[toCamelCase(key)] = typeof val === "object" ? objectToCamelCase(val) : val;
        return newObj;
    }, {});
}

const baseCurrencyDecimals = parseInt(env.VITE_BASE_CURRENCY_DECIMALS || "2", 10);

export function formatCurrency(minDecimals: number | undefined, maxDecimals: number | undefined, value: number) {
    if (typeof value !== "number") return "";
    const minimumFractionDigits = minDecimals ?? baseCurrencyDecimals;
    const maximumFractionDigits = maxDecimals ?? baseCurrencyDecimals;
    return value.toLocaleString("en-US", {minimumFractionDigits, maximumFractionDigits});
}

export function toDecimals(number: number, decimals: number): number {
    return Math.round((number + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
