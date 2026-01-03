import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddReportExclusionIndexes1755545981999 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_report_exclusion_player_id" ON adapter_report_exclusion ("playerId")`);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_report_exclusion_wallet" ON adapter_report_exclusion ("wallet")`);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_report_exclusion_currency" ON adapter_report_exclusion ("currency")`);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_report_exclusion_operator" ON adapter_report_exclusion ("operator")`);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_report_exclusion_brand" ON adapter_report_exclusion ("brand")`);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_report_exclusion_native_id" ON adapter_report_exclusion USING gin ("nativeId" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_report_exclusion_dates" ON adapter_report_exclusion ("startsAt", "endsAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_player_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_wallet"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_currency"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_operator"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_brand"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_native_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_dates"`);
    }
}
