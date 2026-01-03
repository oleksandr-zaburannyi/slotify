import {ISettingsFilter, Settings} from "../db/model/Settings";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import Exception from "@slotify/shared/lib/Exception";

export interface RoundRngState {
    clientSeed: string;
    serverSeed: string;
    nonce: number;
    cursor: number;
}

export async function getRoundRngState(settingsFilter: ISettingsFilter, playerId: string, roundId: string, game: string): Promise<RoundRngState | undefined> {
    if (!(await Settings.isProvablyFair(settingsFilter))) return;

    return await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/getRoundRngState`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({playerId, roundId, game})});
}

export async function updateRoundRngCursor(roundId: string, roundRngState: RoundRngState | undefined, rngPayload: {newRngCursor: number} | undefined, closed: boolean) {
    if (!roundRngState) return;

    if (!rngPayload || rngPayload?.newRngCursor == null) {
        throw new Exception("Games using provably fair RNG are required to provide valid cursor updates");
    }

    if (!closed && roundRngState.cursor === rngPayload.newRngCursor) return;

    const cursor = rngPayload.newRngCursor;

    return await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/updateRoundRngCursor`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({roundId, cursor, closed})});
}

export async function closeRoundRngState(settingsFilter: ISettingsFilter, roundId: string) {
    if (!(await Settings.isProvablyFair(settingsFilter))) return;

    return await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/closeRoundRngState`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({roundId})});
}

export async function initPlayerSeeds(settingsFilter: ISettingsFilter, playerId: string) {
    if (!(await Settings.isProvablyFair(settingsFilter))) return;

    await fetchAndParse(`${getServiceUrl("rng")}/api/fairness/initPlayerSeeds`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({playerId})});
}
