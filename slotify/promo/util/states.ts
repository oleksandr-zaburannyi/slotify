import {EntityManager} from "typeorm";
import {CampaignState} from "../db/model/CampaignState";
import {PlayerState} from "../db/model/PlayerState";
import Exception from "@slotify/shared/lib/Exception";

export const lazyLoadState = (manager: EntityManager, campaignId: string, playerId: string | null, forceReadOnly: boolean = false) => {
    return {
        loadCampaignState: async (readOnly = false) => {
            return (await manager.findOne(CampaignState, {where: {campaignId}, select: ["state"], lock: !forceReadOnly && !readOnly ? {mode: "pessimistic_write"} : undefined}))?.state;
        },
        loadPlayerState: async (readOnly = false) => {
            if (!playerId) throw new Exception("Couldn't load player state", {data: {campaignId}});
            return (await manager.findOne(PlayerState, {where: {campaignId, playerId}, select: ["state"], lock: !forceReadOnly && !readOnly ? {mode: "pessimistic_write"} : undefined}))?.state;
        },
    };
};

export async function saveState(manager: EntityManager, campaignId: string, playerId: string | null, campaignState: any, playerState: any) {
    if (campaignState) {
        await manager.upsert(CampaignState, {campaignId, state: campaignState}, {conflictPaths: ["campaignId"]});
    }
    if (playerState && playerId) {
        await manager.upsert(PlayerState, {campaignId, playerId, state: playerState}, {conflictPaths: ["campaignId", "playerId"]});
    }
}
