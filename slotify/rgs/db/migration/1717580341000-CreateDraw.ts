import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateDraw1717580341000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const tableName = queryRunner.connection.options.entityPrefix + "draw";
        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "drawId", type: "uuid"},
                    {name: "roomId", type: "uuid"},
                    {name: "nextTickTime", type: "bigint"},
                    {name: "tickId", type: "bigint"},
                    {name: "finished", type: "boolean", default: false},
                    {name: "state", type: "jsonb", isNullable: true},
                ],
                indices: [{name: tableName + "_roomId_id", columnNames: ["roomId", "id"], isUnique: true}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "draw", true);
    }
}
