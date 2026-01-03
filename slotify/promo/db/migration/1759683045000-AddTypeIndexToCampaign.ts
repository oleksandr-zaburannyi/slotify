import {MigrationInterface, QueryRunner} from "typeorm";

export class AddTypeIndexToCampaign1759683045000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "promo_campaign_type_createdAt" ON promo_campaign ("type", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX IF EXISTS "promo_campaign_type_createdAt"`);
    }
}
