import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateStreamAccumulation1746365190001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const name = queryRunner.connection.options.entityPrefix + "stream_accumulation";
        await queryRunner.createTable(
            new Table({
                name,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "streamType", type: "varchar"},
                    {name: "streamId", type: "varchar"},
                    {name: "index", type: "bigint"},
                    {name: "data", type: "jsonb"},
                    {name: "nextAccumulationTime", type: "bigint"},
                    {name: "active", type: "boolean", default: true},
                ],
                indices: [{name: name + "_index_access", isUnique: true, columnNames: ["streamId", "index"]}],
            }),
            true,
        );

        await queryRunner.query(`CREATE UNIQUE INDEX ${name}_active_stream ON "${name}" ("streamId") WHERE active IS TRUE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "stream_accumulation", true);
    }
}
