import Exception from "@slotify/shared/lib/Exception";
import {Round} from "../db/model/Round";

export default async function closeRound(roundId: string, status: string) {
    if (!roundId) throw new Exception("RoundId is required to close the round");
    if (status !== "finished" && status !== "cancelled") throw new Exception("Rounds status needs to be 'finished' or 'cancelled'");

    await Round.update({roundId}, {status});
    return {roundId, status};
}
