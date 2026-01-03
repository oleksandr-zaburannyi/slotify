import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexes1722336287000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_round_status_createdAt_active" on rgs_round ("status", "createdAt", "active") where status not in ('force-index-scan')`);
        await queryRunner.query(`drop index concurrently if exists "rgs_round_status_createdAt"`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_playerId_game_id_desc" on rgs_round ("playerId", game, id DESC)`);
        await queryRunner.query(`drop index concurrently if exists "rgs_round_playerId_game_id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_round_status_createdAt_active"`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_status_createdAt" on rgs_round ("status", "createdAt") where status not in ('force-index-scan')`);
        await queryRunner.query(`drop index concurrently if exists "rgs_round_playerId_game_id_desc"`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_playerId_game_id" on rgs_round ("playerId", game, id)`);
    }
}
