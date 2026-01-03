import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class OptimizeReportExclusionPeriodIndex1756831366000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_dates"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "adapter_report_exclusion_period_gist" ON adapter_report_exclusion USING GIST (tstzrange(coalesce("startsAt", '-infinity'), coalesce("endsAt", 'infinity'), '[]'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_report_exclusion_period_gist"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "adapter_report_exclusion_dates" ON adapter_report_exclusion ("startsAt", "endsAt")`);
    }
}
