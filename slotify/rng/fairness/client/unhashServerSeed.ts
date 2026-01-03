import {getConnection} from "@slotify/shared/lib/dbOptions";
import {RngSeeds} from "../../db/model/RngSeeds";
import Exception from "@slotify/shared/lib/Exception";

function is64CharHexString(str: string) {
    const hexRegEx = /^[0-9a-fA-F]{64}$/;
    return hexRegEx.test(str);
}

export async function unhashServerSeed(serverSeedHash: string) {
    if (!is64CharHexString(serverSeedHash)) throw new Exception("Server seed hash should be 64 hex characters");

    const rngSeeds = await getConnection("replica").manager.findOneBy(RngSeeds, {serverSeedHash: serverSeedHash.toLowerCase()});
    if (!rngSeeds) throw new Exception("Server seed not found", {code: "SERVER_SEED_NOT_FOUND"});
    if (rngSeeds.status !== "revealed") throw new Exception("Server seed not revealed", {code: "SERVER_SEED_NOT_REVEALED"});

    return {serverSeed: rngSeeds.serverSeed};
}
