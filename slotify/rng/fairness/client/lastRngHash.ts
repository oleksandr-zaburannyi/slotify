import Exception from "@slotify/shared/lib/Exception";
import {DrawRngHash} from "../../db/model/DrawRngHash";
import {StatusCode} from "@slotify/shared/lib/StatusCode";

export async function lastRngHash(roomId: string): Promise<string> {
    const drawRngHash = await DrawRngHash.findOneBy({roomId, index: 0});

    if (!drawRngHash) {
        throw new Exception("Hash chain for a given room is not yet generated", {
            status: StatusCode.NOT_FOUND,
            code: "CHAIN_NOT_GENERATED",
            data: {roomId},
        });
    }

    return drawRngHash.hash;
}
