import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateAccount1596877438000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "account",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "email", type: "varchar"},
                    {name: "password", type: "varchar"},
                    // {name: "role", type: "varchar"},
                    {name: "permissions", type: "json", isNullable: true},
                    {name: "provider", type: "varchar", isNullable: true},
                    {name: "wallet", type: "varchar", isNullable: true},
                    {name: "operator", type: "varchar", isNullable: true},
                    {name: "brand", type: "varchar", isNullable: true},
                    {name: "lastActivity", type: "timestamptz", isNullable: true},
                ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "account_email", columnNames: ["email"], isUnique: true}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "account", true);
    }
}
