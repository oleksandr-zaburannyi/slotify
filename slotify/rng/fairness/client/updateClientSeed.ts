import {RngSeeds} from "../../db/model/RngSeeds";
import Exception from "@slotify/shared/lib/Exception";
import {generateSeedHash, generateSeed} from "../generateSeed";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {ActiveRngSeedsResponse} from "./activeRngSeeds";
import {RoundRngState} from "../../db/model/RoundRngState";
import {lock, unlock} from "@slotify/shared/lib/lock";
import wait from "@slotify/shared/lib/wait";

const lockId = (playerId: string) => `update-client-seed-lock:${playerId}`;

export async function updateClientSeed(playerId: string, clientSeed: string): Promise<ActiveRngSeedsResponse> {
    if (!(await lock(lockId(playerId), 10000))) {
        throw new Exception("Update client seed in progress", {data: {playerId, clientSeed, lockId}});
    }

    return await getConnection("primary").transaction(async manager => {
        const activeSeeds = await manager.findOne(RngSeeds, {
            where: {playerId, status: "active"},
            lock: {mode: "pessimistic_write"},
        });

        if (!activeSeeds) {
            throw new Exception("Fair RNG state inconsistent - no active Seeds for the given playerId", {data: {playerId, clientSeed}});
        }

        const activeRoundStates = await manager.find(RoundRngState, {
            where: {seedsId: activeSeeds.seedsId, status: "active"},
        });

        if (activeRoundStates.length) {
            throw new Exception("Unable to update client seed when there are active game rounds.");
        }

        const nextServerSeed = generateSeed();
        const nextServerSeedHash = generateSeedHash(nextServerSeed);

        await manager.update(RngSeeds, {seedsId: activeSeeds.seedsId}, {status: "revealed"});
        const newSeeds = await manager
            .create(RngSeeds, {
                playerId,
                clientSeed,
                serverSeed: activeSeeds.nextServerSeed,
                serverSeedHash: activeSeeds.nextServerSeedHash,
                status: "active",
                nextServerSeed,
                nextServerSeedHash,
            })
            .save();

        await wait(500); //rate limiting
        await unlock(lockId(playerId));

        return {
            clientSeed: newSeeds.clientSeed,
            serverSeedHash: newSeeds.serverSeedHash,
            nextServerSeedHash: newSeeds.nextServerSeedHash,
            nonce: 0,
            unfinishedGames: [],
        };
    });
}
