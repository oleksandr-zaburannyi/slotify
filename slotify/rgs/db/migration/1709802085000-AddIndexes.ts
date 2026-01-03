import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIndexes1709802085000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rgs_round_active_status_createdAt"`);
        await queryRunner.query(`create unique index concurrently if not exists "rgs_round_id_game_playerId" on rgs_round (id, game, "playerId")`);
        await queryRunner.query(`create index concurrently if not exists "rgs_round_createdAt_status_active" on rgs_round ("createdAt", status, active) where active is not true`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_round_active_status_createdAt" ON rgs_round (active, status, "createdAt") where active is not true`);
        await queryRunner.query(`drop index if exists "rgs_round_id_game_playerId"`);
        await queryRunner.query(`drop index if exists "rgs_round_createdAt_status_active"`);
    }
}
