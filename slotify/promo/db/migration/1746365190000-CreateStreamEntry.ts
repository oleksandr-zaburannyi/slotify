import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateStreamEntry1746365190000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const name = queryRunner.connection.options.entityPrefix + "stream_entry";
        await queryRunner.createTable(
            new Table({
                name,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "streamId", type: "varchar"},
                    {name: "data", type: "jsonb"},
                    {name: "processed", type: "boolean", default: false},
                    {name: "accumulationIndex", type: "bigint", isNullable: true},
                ],
                indices: [{name: name + "_accumulation_index_access", columnNames: ["streamId", "accumulationIndex"]}],
            }),
            true,
        );

        await queryRunner.query(`CREATE INDEX ${name}_unprocessed_sequence_access ON "${name}" ("streamId", id) WHERE processed = false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "stream_entry", true);
    }
}
