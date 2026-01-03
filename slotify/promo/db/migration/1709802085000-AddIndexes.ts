import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIndexes1709802085000 implements MigrationInterface {
    transaction = false;

    private fields = ["wallets", "operators", "brands", "providers", "games", "playerIds", "nativeIds"];

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "promo_campaign_end" on promo_campaign ("end")`);
        await queryRunner.query(`create index concurrently if not exists "promo_campaign_gin_filter" on promo_campaign using gin
            (
             COALESCE("nativeIds", '["*"]'),
             COALESCE("playerIds", '["*"]'),
             COALESCE("wallets", '["*"]'),
             COALESCE("operators", '["*"]'),
             COALESCE("brands", '["*"]'),
             COALESCE("providers", '["*"]'),
             COALESCE("games", '["*"]')
                )
        `);
        for (const field of this.fields) {
            await queryRunner.query(`DROP INDEX IF EXISTS "promo_campaign_${field}"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "promo_campaign_${field}_gin"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "promo_campaign_end"`);
        await queryRunner.query(`drop index if exists "promo_campaign_gin_filter"`);
        for (const field of this.fields) {
            await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "promo_campaign_${field}" ON promo_campaign ("${field}")`);
            await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "promo_campaign_${field}_gin" ON promo_campaign using gin ("${field}")`);
        }
    }
}
