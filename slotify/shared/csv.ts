export function toCSV(items: any[]) {
    const separator = ",";
    const content =
        Object.keys(items[0] || {})
            .map(value => `"${value}"`)
            .join(separator) +
        "\n" +
        items
            .map(row =>
                Object.values(row)
                    .map(value => `"${valueToString(value)}"`)
                    .join(separator),
            )
            .join("\n");

    return content;
}

function valueToString(value: any): string {
    if (value === undefined) return "";
    if (value === null) return "";
    if (value.toString() === "[object Object]") return JSON.stringify(value).replace(/"/g, `""`);
    return value.toString().replaceAll(`"`, `""`);
}
