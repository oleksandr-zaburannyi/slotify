import {RngSeeds} from "../db/model/RngSeeds";
import {generateSeed, generateSeedHash} from "./generateSeed";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {lock, unlock} from "@slotify/shared/lib/lock";
import Exception from "@slotify/shared/lib/Exception";

const lockId = (playerId: string) => `init-player-seeds-lock:${playerId}`;

export async function initPlayerSeeds(playerId: string): Promise<void> {
    if (!(await lock(lockId(playerId), 10000))) {
        throw new Exception("Update client seed in progress", {data: {playerId}});
    }
    await getConnection("primary").transaction(async manager => {
        const activeSeeds = await manager.findOne(RngSeeds, {where: {playerId, status: "active"}});

        if (!activeSeeds) {
            const clientSeed = generateSeed();
            const serverSeed = generateSeed();
            const nextServerSeed = generateSeed();
            await manager
                .create(RngSeeds, {
                    playerId,
                    clientSeed,
                    serverSeed,
                    serverSeedHash: generateSeedHash(serverSeed),
                    status: "active",
                    nextServerSeed,
                    nextServerSeedHash: generateSeedHash(nextServerSeed),
                })
                .save();
        }
    });

    await unlock(lockId(playerId));
}
