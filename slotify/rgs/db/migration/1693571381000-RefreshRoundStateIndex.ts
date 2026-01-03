import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class RefreshRoundStateIndex1693571381000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rgs_round_status_createdAt"`);
        await queryRunner.query(`create index if not exists "rgs_round_status_createdAt" on rgs_round ("status", "createdAt") where status NOT IN ('finished', 'cancelled')`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rgs_round_status_createdAt"`);
        await queryRunner.query(`create index if not exists "rgs_round_status_createdAt" on rgs_round ("status", "createdAt") where status IN ('started', 'settled', 'failed', 'finisihing')`);
    }
}
