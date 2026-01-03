import {getConnection} from "@slotify/shared/lib/dbOptions";
import {RoomRngSeed} from "../db/model/RoomRngSeed";
import Exception from "@slotify/shared/lib/Exception";
import logger from "@slotify/shared/lib/logger";

export async function generateHashChain(roomId: string, chainLength: number) {
    if (!Number.isInteger(chainLength) || chainLength <= 1) {
        throw new Exception("Incorrect chain length", {data: {roomId}});
    }

    if (await RoomRngSeed.findOneBy({roomId})) {
        throw new Exception("RoomRngSeed for a given roomId already exists", {data: {roomId}});
    }

    await RoomRngSeed.insert({roomId, chainLength});

    const start = Date.now();

    getConnection("primary")
        .query(`CALL generate_hash_chain($1, $2);`, [roomId, chainLength])
        .then(() => logger.info(`Hash chain for room ${roomId}, length ${chainLength} generation finished in ${Math.round((Date.now() - start) / 1000)} seconds`));

    return {success: true};
}
