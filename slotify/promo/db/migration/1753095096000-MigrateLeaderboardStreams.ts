import {MigrationInterface, QueryRunner} from "typeorm";
import {Campaign} from "../model/Campaign";
import {CampaignState} from "../model/CampaignState";
import logger from "@slotify/shared/lib/logger";

export class MigrateLeaderboardStreams1753095096000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const campaigns = await queryRunner.manager.find(Campaign, {where: {type: "leaderboard"}, select: ["campaignId"]});
        for (const {campaignId} of campaigns) {
            const campaignState = await queryRunner.manager.findOneBy(CampaignState, {campaignId});

            if (!campaignState) {
                logger.error("Could not find campaign state", {campaignId});
                continue;
            }

            const leaderboards = campaignState?.state || {};
            await queryRunner.manager.update(
                CampaignState,
                {campaignId},
                {
                    state: {
                        data: {leaderboards},
                        nextAccumulationTime: Date.now(),
                        index: 0,
                    } as any,
                },
            );
        }
    }

    public async down(): Promise<void> {}
}
