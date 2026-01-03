import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";
import {DrawRngHash} from "../db/model/DrawRngHash";
import {RoomRngSeed} from "../db/model/RoomRngSeed";
import {IDrawRngState} from "../random/IDrawRngState";

export async function getDrawRngState(roomId: string, drawId: string): Promise<IDrawRngState> {
    return await getConnection("primary").transaction(async manager => {
        const roomRngSeed = await manager.findOne(RoomRngSeed, {
            where: {roomId},
            lock: {mode: "pessimistic_write"},
        });

        if (!roomRngSeed || !roomRngSeed.seed) {
            throw new Exception("Fair RNG state inconsistent - no rng seed for a room", {data: {roomId, drawId}});
        }
        const {activeIndex, chainLength, seed} = roomRngSeed;

        let drawRngHash = await manager.findOne(DrawRngHash, {
            where: {drawId},
            lock: {mode: "pessimistic_write"},
        });

        if (drawRngHash) {
            const {hash, cursor, index} = drawRngHash;

            if (index < activeIndex) {
                throw new Exception("Fair RNG state inconsistent - can't get hash that was already consumed", {
                    data: {
                        roomId,
                        drawId,
                    },
                });
            }

            return {
                hash,
                seed,
                cursor,
            };
        }

        const hashIndex = activeIndex + 1;
        if (hashIndex >= chainLength) {
            throw new Exception("Hash chain for a given room is depleted", {
                code: "CHAIN_DEPLETED",
                data: {
                    roomId,
                    drawId,
                },
            });
        }

        await manager.update(DrawRngHash, {roomId, index: hashIndex}, {drawId});
        await manager.update(RoomRngSeed, {roomId}, {activeIndex: hashIndex});
        drawRngHash = await manager.findOne(DrawRngHash, {
            where: {drawId},
            lock: {mode: "pessimistic_write"},
        });

        return {
            hash: drawRngHash!.hash,
            seed,
            cursor: 0,
        };
    });
}
