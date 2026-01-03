export function isDevMode(): boolean {
    return process.env.IS_PRODUCTION === "false";
}
