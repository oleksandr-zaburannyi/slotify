import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateTick1708942302178 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const tableName = queryRunner.connection.options.entityPrefix + "tick";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "roomId", type: "uuid"},
                    {name: "time", type: "bigint"},
                    {name: "state", type: "jsonb", isNullable: true},
                    {name: "wins", type: "jsonb", isNullable: true},
                    {name: "cancels", type: "jsonb", isNullable: true},
                    {name: "broadcast", type: "jsonb", isNullable: true},
                    {name: "messages", type: "jsonb", isNullable: true},
                    {name: "latestCommandId", type: "bigint"},
                    {name: "nextTickTime", type: "bigint"},
                    {name: "drawId", type: "uuid"},
                    {name: "drawFinished", type: "boolean", isNullable: true},
                ],
                indices: [
                    {name: tableName + "_roomId_id", columnNames: ["roomId", "id"], isUnique: true},
                    {name: tableName + "_drawId_createdAt", columnNames: ["drawId", "createdAt"]},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "tick", true);
    }
}
