import {MigrationInterface, QueryRunner, Table, TableColumn} from "typeorm";

export class AddSystemCommandAndRoomKey1753804284000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = queryRunner.connection.options.entityPrefix + "system_command";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "commandId", type: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "processed", type: "boolean", isNullable: true},
                    {name: "roomId", type: "uuid"},
                    {name: "systemId", type: "uuid"},
                    {name: "drawId", type: "uuid"},
                    {name: "time", type: "bigint"},
                    {name: "action", type: "varchar"},
                    {name: "params", type: "jsonb", isNullable: true},
                    {name: "tickId", type: "bigint", isNullable: true},
                    {name: "data", type: "jsonb", isNullable: true},
                ],
                indices: [
                    {name: tableName + "_commandId", columnNames: ["commandId"], isUnique: true},
                    {name: tableName + "_drawId_createdAt", columnNames: ["drawId", "createdAt"]},
                    {name: tableName + "_tickId_drawId_systemId", columnNames: ["tickId", "drawId", "systemId"]},
                ],
            }),
            true,
        );

        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "room", new TableColumn({name: "secretKey", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "room", "secretKey");
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "system_command", true);
    }
}
