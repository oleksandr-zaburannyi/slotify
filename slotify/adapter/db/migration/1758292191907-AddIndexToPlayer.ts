import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexToPlayer1758292191907 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`create index concurrently if not exists adapter_player_id_incl_wallet on adapter_player (id) include (wallet)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index concurrently if exists adapter_player_id_incl_wallet`);
    }
}
