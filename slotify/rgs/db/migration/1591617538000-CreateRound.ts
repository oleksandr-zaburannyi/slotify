import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateRound1591617538000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "round",
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true},
                    {name: "roundId", type: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "playerId", type: "uuid"},
                    {name: "status", type: "varchar"},
                    {name: "game", type: "varchar"},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "round_playerId_game_status_createdAt", columnNames: ["playerId", "game", "status", "createdAt"], isUnique: false},
                    {name: queryRunner.connection.options.entityPrefix + "round_roundId", columnNames: ["roundId"], isUnique: true},
                    {name: queryRunner.connection.options.entityPrefix + "round_status_createdAt_where", columnNames: ["status", "createdAt"], isUnique: false, where: "status IN ('started', 'settled', 'failed')"},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "round", true);
    }
}
