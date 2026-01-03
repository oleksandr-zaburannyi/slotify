import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreatePlayerState1654688609000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "player_state",
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "campaignId", type: "uuid", isNullable: true},
                    {name: "playerId", type: "varchar", isNullable: true},
                    {name: "state", type: "json"},
                ],
                // foreignKeys: [
                //     {referencedTableName: queryRunner.connection.options.entityPrefix + "campaign", columnNames: ["campaignId"], referencedColumnNames: ["campaignId"]},
                // ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "player_state_campaignId_playerId", columnNames: ["campaignId", "playerId"], isUnique: true}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "player_state", true);
    }
}
