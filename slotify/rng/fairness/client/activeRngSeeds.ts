import {RngSeeds} from "../../db/model/RngSeeds";
import {RoundRngState} from "../../db/model/RoundRngState";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";

export interface ActiveRngSeedsResponse {
    clientSeed: string;
    serverSeed?: string;
    serverSeedHash: string;
    nextServerSeedHash: string;
    nonce: number;
    unfinishedGames: string[];
}

export async function activeRngSeeds(playerId: string): Promise<ActiveRngSeedsResponse> {
    return await getConnection("replica").transaction(async manager => {
        const activeSeeds = await manager.findOneBy(RngSeeds, {playerId, status: "active"});
        if (!activeSeeds) {
            throw new Exception("Fair RNG state inconsistent - no active Seeds for the given playerId", {data: {playerId}});
        }

        const latestRoundState = await manager.findOne(RoundRngState, {
            where: {seedsId: activeSeeds.seedsId},
            order: {nonce: "DESC"},
        });

        const activeRoundStates = await manager.find(RoundRngState, {
            where: {seedsId: activeSeeds.seedsId, status: "active"},
        });

        return {
            clientSeed: activeSeeds.clientSeed,
            serverSeedHash: activeSeeds.serverSeedHash,
            nextServerSeedHash: activeSeeds.nextServerSeedHash,
            nonce: latestRoundState ? latestRoundState.nonce + 1 : 0,
            unfinishedGames: [...new Set(activeRoundStates.map(roundState => roundState.game))],
        };
    });
}
