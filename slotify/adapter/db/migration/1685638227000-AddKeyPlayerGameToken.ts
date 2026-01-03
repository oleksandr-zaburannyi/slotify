import {MigrationInterface, QueryRunner} from "typeorm";

export class AddKeyPlayerGameToken1685638227000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index if exists "adapter_player_game_token_playerId_game"`);
        await queryRunner.query(`create index if not exists "adapter_player_game_token_playerId_provider_game" on adapter_player_game_token ("playerId", "provider", "game")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index if exists "adapter_player_game_token_playerId_provider_game"`);
        await queryRunner.query(`create index if not exists "adapter_player_game_token_playerId_game" on adapter_player_game_token ("playerId", "game")`);
    }
}
