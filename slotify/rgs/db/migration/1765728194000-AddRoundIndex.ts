import {MigrationInterface, QueryRunner} from "typeorm";

export class AddRoundIndex1765728194000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_round_playerId_status_game_id" on rgs_round ("playerId", "status", "game", "id") where status IN ('started', 'unpaid')`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_round_playerId_status_game_id"`);
    }
}
