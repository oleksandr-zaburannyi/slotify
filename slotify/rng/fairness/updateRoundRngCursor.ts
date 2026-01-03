import {RoundRngState} from "../db/model/RoundRngState";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";

export async function updateRoundRngCursor(roundId: string, cursor: number, closed?: boolean) {
    return await getConnection("primary").transaction(async manager => {
        const roundRngState = await manager.findOne(RoundRngState, {
            where: {roundId},
            lock: {mode: "pessimistic_write"},
        });

        if (!roundRngState) {
            throw new Exception("Fair RNG state inconsistent - no Round RNG State for a given roundId", {data: {roundId, cursor}});
        }

        if (roundRngState.status !== "active") {
            throw new Exception("Fair RNG state inconsistent - attempting to update cursor on a closed Round RNG State", {data: {roundId, cursor, roundRngState}});
        }

        if (!Number.isInteger(cursor) || cursor < roundRngState.cursor) {
            throw new Exception("Fair RNG state inconsistent - incorrect provably fair cursor returned by the game", {data: {roundId, cursor, roundRngState}});
        }

        await manager.update(RoundRngState, {roundId}, {cursor, status: closed ? "closed" : "active"});
    });
}
