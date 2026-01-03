import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddProviderToPlayerGameToken1685623975000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "player_game_token", [new TableColumn({name: "provider", type: "varchar", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "player_game_token", "provider");
    }
}
