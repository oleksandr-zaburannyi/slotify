import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";
import {DrawRngHash} from "../../db/model/DrawRngHash";
import {RoomRngSeed} from "../../db/model/RoomRngSeed";
import {IInitialDrawRngState} from "../../random/IDrawRngState";

export async function drawRngState(drawId: string): Promise<IInitialDrawRngState & {hashIndex: number}> {
    return await getConnection("replica").transaction(async manager => {
        const drawRngHash = await manager.findOneBy(DrawRngHash, {drawId});
        if (!drawRngHash) {
            throw new Exception(`Fair RNG state malfunction - RNG Hash for a given drawId ${drawId} does not exist`);
        }
        const {roomId, hash, index: hashIndex} = drawRngHash;

        const roomRngSeed = await manager.findOneBy(RoomRngSeed, {roomId});
        if (!roomRngSeed || !roomRngSeed.seed) {
            throw new Exception(`Fair RNG state malfunction - RNG Seed for a given roomId ${roomId} does not exist`);
        }
        const {seed, activeIndex} = roomRngSeed;

        if (activeIndex <= hashIndex) {
            throw new Exception(`Fair RNG state malfunction - RNG hash #${hashIndex} is not yet revealed`);
        }

        return {
            hash,
            hashIndex,
            seed,
        };
    });
}
