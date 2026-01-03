import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexesToCampaignState1745323493000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS promo_campaign_state_end ON promo_campaign_state (ended) where ended = false`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX IF EXISTS promo_campaign_state_end`);
    }
}
