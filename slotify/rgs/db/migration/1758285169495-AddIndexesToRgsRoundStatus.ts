import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexesToRgsRoundStatus1758285169495 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`create index concurrently if not exists rgs_round_status_pending on rgs_round ("createdAt", "playerId") include ("roundId") where status in ('started','finishing','unpaid')`);
        await queryRunner.query(`create index concurrently if not exists rgs_round_status_cancelled on rgs_round ("failedAt", "playerId") include ("roundId") where status = 'cancelled'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index concurrently if exists rgs_round_status_cancelled`);
        await queryRunner.query(`drop index concurrently if exists rgs_round_status_pending`);
    }
}
