import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCriticalFile1694004196206 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "critical_file",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "name", type: "varchar"},
                    {name: "component", type: "varchar"},
                    {name: "origin", type: "varchar"},
                    {name: "service", type: "varchar", isNullable: true},
                    {name: "path", type: "varchar"},
                    {name: "checksum", type: "varchar"},
                    {name: "jurisdictions", type: "jsonb", isNullable: true},
                    {name: "blockOnError", type: "boolean"},
                    {name: "comment", type: "varchar", isNullable: true},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "critical_file", true);
    }
}
