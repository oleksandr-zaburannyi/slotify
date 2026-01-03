export function round(value: number, decimal: number = 2): number {
    const power = Math.pow(10, decimal);
    return Math.round((value + Number.EPSILON) * power) / power;
}
