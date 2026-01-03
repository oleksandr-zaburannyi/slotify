import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateAuditLog1654500656000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "audit_log",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "date", type: "timestamptz", default: "now()"},
                    {name: "email", type: "varchar", isNullable: true},
                    {name: "type", type: "varchar"},
                    {name: "action", type: "varchar"},
                    {name: "variables", type: "json", isNullable: true},
                    {name: "result", type: "json", isNullable: true},
                    {name: "success", type: "boolean"},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "audit_log", true);
    }
}
