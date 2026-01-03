import {MigrationInterface, QueryRunner} from "typeorm";

export class AddRoundRetryIndex1761736649000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_round_status_retry" ON rgs_round ("status") where "status" in ('failed', 'started', 'unpaid')`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_round_status_retry"`);
    }
}
