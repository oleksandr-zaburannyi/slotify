import {RngSeeds} from "../db/model/RngSeeds";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";
import {RoundRngState} from "../db/model/RoundRngState";
import {IRoundRngState} from "../random/IRoundRngState";

export async function getRoundRngState(playerId: string, roundId: string, game: string): Promise<IRoundRngState> {
    return await getConnection("primary").transaction(async manager => {
        const activeSeeds = await manager.findOne(RngSeeds, {
            where: {playerId, status: "active"},
            lock: {mode: "pessimistic_write"},
        });

        if (!activeSeeds) {
            throw new Exception("Fair RNG state inconsistent - no active Seeds for the given playerId", {data: {playerId, roundId, game}});
        }

        const roundState = await manager.findOne(RoundRngState, {
            where: {playerId, roundId, game},
            lock: {mode: "pessimistic_write"},
        });

        if (roundState && roundState.status !== "active") {
            throw new Exception("Fair RNG state inconsistent - requested round state is closed for further gameplay", {data: {playerId, roundId, game, activeSeeds, roundState}});
        }

        if (roundState && roundState?.seedsId !== activeSeeds.seedsId) {
            throw new Exception("Fair RNG state inconsistent - started Round refers to inactive Seeds", {data: {playerId, roundId, game, activeSeeds, roundState}});
        }

        let nonce = roundState?.nonce;
        let cursor = roundState?.cursor;
        if (!roundState) {
            const latestRoundState = await manager.findOne(RoundRngState, {
                where: {seedsId: activeSeeds.seedsId},
                order: {nonce: "DESC"},
                lock: {mode: "pessimistic_write"},
            });

            nonce = latestRoundState ? latestRoundState.nonce + 1 : 0;
            cursor = 0;
            await manager.insert(RoundRngState, {
                playerId,
                game,
                roundId,
                seedsId: activeSeeds.seedsId,
                nonce,
                cursor,
                status: "active",
            });
        }

        return {
            clientSeed: activeSeeds.clientSeed,
            serverSeed: activeSeeds.serverSeed,
            nonce: nonce!,
            cursor: cursor!,
        };
    });
}
