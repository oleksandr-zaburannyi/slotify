import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";
import {DrawRngHash} from "../db/model/DrawRngHash";
import {RoomRngSeed} from "../db/model/RoomRngSeed";

export async function updateRngHashCursor(drawId: string, cursor: number) {
    return await getConnection("primary").transaction(async manager => {
        const drawRngHash = await manager.findOne(DrawRngHash, {
            where: {drawId},
            lock: {mode: "pessimistic_write"},
        });

        if (!drawRngHash) {
            throw new Exception("Fair RNG state inconsistent - no rng hash for a given draw", {data: {drawId, cursor}});
        }

        if (drawRngHash.cursor > cursor) {
            throw new Exception("Fair RNG state inconsistent - requested rng hash cursor update is lower then then current one", {
                data: {
                    drawRngHash,
                    cursor,
                },
            });
        }

        const roomRngSeed = await manager.findOne(RoomRngSeed, {
            where: {roomId: drawRngHash.roomId},
            lock: {mode: "pessimistic_write"},
        });

        if (roomRngSeed!.activeIndex > drawRngHash.index) {
            throw new Exception("Fair RNG state inconsistent - cant update cursor of rng hash that is not active", {
                data: {
                    drawRngHash,
                    cursor,
                },
            });
        }

        await manager.update(DrawRngHash, {drawId}, {cursor});

        return {hash: drawRngHash.hash, cursor};
    });
}
