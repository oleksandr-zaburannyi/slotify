import {RngSeeds} from "../../db/model/RngSeeds";
import {RoundRngState} from "../../db/model/RoundRngState";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";

interface IRoundRngPublicState {
    clientSeed: string;
    serverSeed?: string;
    status: "active" | "revealed";
    serverSeedHash: string;
    nextServerSeedHash: string;
    nonce: number;
}

export async function roundRngState(roundId: string): Promise<IRoundRngPublicState> {
    return await getConnection("replica").transaction(async manager => {
        const roundRngState = await manager.findOneBy(RoundRngState, {roundId});
        if (!roundRngState) {
            throw new Exception(`Fair RNG state malfunction - RNG State for roundId ${roundId} does not exist`);
        }

        const roundSeeds = await manager.findOneBy(RngSeeds, {seedsId: roundRngState.seedsId});
        if (!roundSeeds) {
            throw new Exception(`Fair RNG state malfunction - RNG Seeds for a roundId ${roundId} do not exist`);
        }

        return {
            clientSeed: roundSeeds.clientSeed,
            serverSeedHash: roundSeeds.serverSeedHash,
            nextServerSeedHash: roundSeeds.nextServerSeedHash,
            nonce: roundRngState.nonce,
            serverSeed: roundSeeds.status === "revealed" ? roundSeeds.serverSeed : undefined,
            status: roundSeeds.status,
        };
    });
}
