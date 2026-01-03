export function isMultiple(x: number, y: number): boolean {
    return Math.round(x / y) / (1 / y) === x;
}
