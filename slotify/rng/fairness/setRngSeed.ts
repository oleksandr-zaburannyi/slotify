import {RoomRngSeed} from "../db/model/RoomRngSeed";
import Exception from "@slotify/shared/lib/Exception";
import {StatusCode} from "@slotify/shared/lib/StatusCode";
import {lastRngHash} from "./client/lastRngHash";

export async function setRngSeed(roomId: string, seed: string) {
    const roomRngSeed = await RoomRngSeed.findOneBy({roomId});
    if (!roomRngSeed) {
        throw new Exception("RoomRngSeed for a given room doesn't exist", {
            status: StatusCode.NOT_FOUND,
            data: {roomId},
        });
    }

    if (roomRngSeed.seed) {
        throw new Exception("Seed for a given room is already set", {
            status: StatusCode.BAD_REQUEST,
            data: {roomId, activeSeed: roomRngSeed.seed, newSeed: seed},
        });
    }

    const lastHash = await lastRngHash(roomId);

    await RoomRngSeed.update({roomId}, {lastHash, seed});

    return {lastHash, chainLength: roomRngSeed.chainLength, seed};
}
