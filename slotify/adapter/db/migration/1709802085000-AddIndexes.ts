import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIndexes1709802085000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "adapter_audit_log_date" on adapter_audit_log (date)`);
        await queryRunner.query(`create index concurrently if not exists "adapter_session_endedAt_active" on adapter_session ("endedAt", active) where active is not true`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "adapter_audit_log_date"`);
        await queryRunner.query(`drop index if exists "adapter_session_endedAt_active"`);
    }
}
