import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import Exception from "@slotify/shared/lib/Exception";

export interface DrawRngState {
    hash: string;
    seed: string;
    cursor: number;
}

export async function generateHashChain(roomId: string, chainLength: number) {
    if (!Number.isInteger(chainLength) || chainLength < 0 || chainLength > 10_000_000) {
        throw new Exception("Provably fair chainLength needs to be a positive integer not greater then 100M");
    }

    await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/generateHashChain`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({roomId, chainLength}),
    });
}

export async function setRngSeed(roomId: string, seed: string) {
    return await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/setRngSeed`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({roomId, seed}),
    });
}

export async function getDrawRngState(roomId: string, drawId: string): Promise<DrawRngState> {
    return await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/getDrawRngState`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({roomId, drawId}),
    });
}

export async function updateRngHashCursor(drawId: string, cursor: number, previousRngState: DrawRngState) {
    if (previousRngState.cursor < cursor) {
        return await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/updateRngHashCursor`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({drawId, cursor}),
        });
    }
}
