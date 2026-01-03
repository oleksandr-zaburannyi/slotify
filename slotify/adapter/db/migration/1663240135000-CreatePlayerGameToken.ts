import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreatePlayerGameToken1663240135000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "player_game_token",
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "playerId", type: "varchar"},
                    {name: "game", type: "varchar"},
                    {name: "token", type: "varchar"},
                ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "player_game_token_playerId_game", columnNames: ["playerId", "game"], isUnique: true}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "player_game_token", true);
    }
}
