import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class ImproveRoundStateIndex1700734953000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_round_status_createdAt"`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_status_createdAt" on rgs_round ("status", "createdAt") where status NOT IN ('finished', 'cancelled', 'force-index-scan')`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_round_status_createdAt"`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_status_createdAt" on rgs_round ("status", "createdAt") where status IN ('finished', 'cancelled')`);
    }
}
