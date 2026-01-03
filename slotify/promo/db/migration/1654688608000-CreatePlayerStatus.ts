import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreatePlayerStatusIn1654688608000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "player_status",
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "playerId", type: "varchar"},
                    {name: "campaignId", type: "uuid"},
                    {name: "init", type: "boolean", isNullable: true},
                    {name: "optIn", type: "boolean", isNullable: true},
                    {name: "finished", type: "boolean", isNullable: true},
                    {name: "acknowledged", type: "boolean", isNullable: true},
                ],
                foreignKeys: [{referencedTableName: queryRunner.connection.options.entityPrefix + "campaign", columnNames: ["campaignId"], referencedColumnNames: ["campaignId"]}],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "player_status_campaignId_playerId", columnNames: ["campaignId", "playerId"], isUnique: true},
                    {name: queryRunner.connection.options.entityPrefix + "player_status_acknowledged_optIn", columnNames: ["acknowledged", "optIn"], isUnique: false},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "player_status", true);
    }
}
