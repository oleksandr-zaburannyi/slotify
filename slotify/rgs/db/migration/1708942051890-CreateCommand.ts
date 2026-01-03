import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateCommand1708942051890 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const tableName = queryRunner.connection.options.entityPrefix + "command";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "commandId", type: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "roomId", type: "uuid"},
                    {name: "playerId", type: "uuid"},
                    {name: "drawId", type: "uuid"},
                    {name: "time", type: "bigint"},
                    {name: "action", type: "varchar"},
                    {name: "bet", type: "numeric", isNullable: true},
                    {name: "currency", type: "varchar", isNullable: true},
                    {name: "params", type: "jsonb", isNullable: true},
                    {name: "tickId", type: "bigint", isNullable: true},
                    {name: "withdrawalStatus", type: "varchar", isNullable: true},
                ],
                indices: [
                    {name: tableName + "_commandId", columnNames: ["commandId"], isUnique: true},
                    {name: tableName + "_drawId_createdAt", columnNames: ["drawId", "createdAt"]},
                    {name: tableName + "_roomId_id_withdrawalStatus", columnNames: ["roomId", "id", "withdrawalStatus"], isUnique: true},
                    {name: tableName + "_roomId_playerId_action_withdrawalStatus", columnNames: ["roomId", "playerId", "action", "withdrawalStatus"], isUnique: true},
                    {name: tableName + "_tickId_drawId_playerId", columnNames: ["tickId", "drawId", "playerId"]},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "command", true);
    }
}
