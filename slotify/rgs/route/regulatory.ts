import evaluate from "./evaluate";

export default async function regulatory(roundId: string, jurisdiction?: string) {
    if (jurisdiction === "pt") {
        // call game only if it's required

        return {pt: await evaluate("regulatory-pt", undefined, roundId)};
    }
}
