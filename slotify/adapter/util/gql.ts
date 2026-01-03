export function normalizeWhitespaces(str: string): string {
    return str.replace(/\s+/g, " ").trim();
}
