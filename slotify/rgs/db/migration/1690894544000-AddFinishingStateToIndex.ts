import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddFinishingStateToIndex1690894544000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index if not exists "rgs_round_status_createdAt" on rgs_round ("status", "createdAt") where status IN ('started', 'settled', 'failed', 'finishing')`);
        await queryRunner.query(`drop index if exists "rgs_round_status_createdAt_where"`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index if not exists "rgs_round_status_createdAt_where" on rgs_round ("status", "createdAt") where status IN ('started', 'settled', 'failed')`);
        await queryRunner.query(`drop index if exists "rgs_round_status_createdAt"`);
    }
}
