import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexForPreviousRound1705938054000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "rgs_round_playerId_game_id" ON rgs_round ("playerId", game, id)`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX IF EXISTS "rgs_round_playerId_game_id"`);
    }
}
