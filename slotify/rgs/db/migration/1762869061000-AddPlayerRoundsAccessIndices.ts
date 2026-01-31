import {MigrationInterface, QueryRunner} from "typeorm";

export class AddPlayerRoundsAccessIndices1762869061000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`create index concurrently if not exists "rgs_round_player_started_access" on rgs_round ("playerId", "provider", "game") where status = 'started'`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_player_failed_access" on rgs_round ("playerId", "provider", "game", "failedAt") where status = 'failed'`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_player_unpaid_access" on rgs_round ("playerId", "provider", "game", "completedAt") where status = 'unpaid'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index concurrently if exists "rgs_round_player_started_access"`);
        await queryRunner.query(`drop index concurrently if exists "rgs_round_player_failed_access"`);
        await queryRunner.query(`drop index concurrently if exists "rgs_round_player_unpaid_access"`);
    }
}
