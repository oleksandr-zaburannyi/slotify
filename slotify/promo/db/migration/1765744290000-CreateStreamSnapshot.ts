import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateStreamSnapshot1765744290000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const name = queryRunner.connection.options.entityPrefix + "stream_snapshot";
        await queryRunner.createTable(
            new Table({
                name,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "streamId", type: "varchar"},
                    {name: "accumulationIndex", type: "bigint"},
                    {name: "data", type: "jsonb"},
                ],
                indices: [{name: name + "_streamId_createdAt", isUnique: true, columnNames: ["streamId", "createdAt"]}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "stream_snapshot", true);
    }
}
