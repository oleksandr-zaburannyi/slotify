import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexes1722336287000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "adapter_sessions_active_endedAt" on adapter_session ("active", "endedAt") where active IS NOT TRUE`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "adapter_sessions_active_endedAt"`);
    }
}
