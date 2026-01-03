import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexesToCampaign1705938054000 implements MigrationInterface {
    transaction = false;

    private fields = ["wallets", "operators", "brands", "providers", "games", "playerIds", "nativeIds"];

    public async up(queryRunner: QueryRunner): Promise<any> {
        for (const field of this.fields) {
            await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "promo_campaign_${field}" ON promo_campaign ("${field}")`);
            await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "promo_campaign_${field}_gin" ON promo_campaign using gin ("${field}")`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        for (const field of this.fields) {
            await queryRunner.query(`DROP INDEX IF EXISTS "promo_campaign_${field}"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "promo_campaign_${field}_gin"`);
        }
    }
}
