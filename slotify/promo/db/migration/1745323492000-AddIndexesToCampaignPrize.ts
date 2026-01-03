import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexesToCampaignPrize1745323492000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS promo_campaign_prize_paid ON promo_campaign_prize (paid) where paid = false`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX IF EXISTS promo_campaign_prize_paid`);
    }
}
