import {RoundRngState} from "../db/model/RoundRngState";

export async function closeRoundRngState(roundId: string) {
    await RoundRngState.update({roundId}, {status: "closed"});
}
