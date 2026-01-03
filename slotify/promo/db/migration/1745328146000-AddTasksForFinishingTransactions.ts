import {LessThan, MigrationInterface, QueryRunner} from "typeorm";
import {CampaignState} from "../model/CampaignState";
import {Campaign} from "../model/Campaign";
import {scheduleCampaignFinish} from "../../util/scheduleTasks";

export class AddTasksForFinishingTransactions1745328146000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.manager.transaction(async manager => {
            const query = manager.createQueryBuilder(CampaignState, "campaignState");
            const subQuery = query
                .subQuery()
                .select(`"campaignId"`)
                .from(Campaign, "campaign")
                .where({end: LessThan(new Date())})
                .getQuery();
            const campaignStates = await query.where(`"campaignId" IN (${subQuery})`).andWhere({ended: false}).setLock("pessimistic_write").setOnLocked("skip_locked").getMany();

            for (const {campaignId} of campaignStates) {
                const {end} = await queryRunner.manager.findOneOrFail(Campaign, {where: {campaignId}, select: ["campaignId", "end"]});
                await scheduleCampaignFinish({campaignId, end});
            }
        });
    }

    public async down(): Promise<any> {}
}
