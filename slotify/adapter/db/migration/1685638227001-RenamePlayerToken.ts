import {MigrationInterface, QueryRunner} from "typeorm";

export class RenamePlayerToken1685638227001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable("adapter_player_game_token");
        if (tableExists) {
            await queryRunner.renameTable("adapter_player_game_token", "adapter_player_token");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable("adapter_player_token");
        if (tableExists) {
            await queryRunner.renameTable("adapter_player_token", "adapter_player_game_token");
        }
    }
}
