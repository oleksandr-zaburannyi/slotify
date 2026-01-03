import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddCreatedAtIndexToSession1756133184000 implements MigrationInterface {
    transaction = false;
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "adapter_session_createdAt" on adapter_session ("createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "adapter_session_createdAt"`);
    }
}
