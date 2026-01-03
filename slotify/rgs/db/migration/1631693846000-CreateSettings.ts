import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateSettings1631693846000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "settings",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "wallets", type: "json", isNullable: true},
                    {name: "operators", type: "json", isNullable: true},
                    {name: "brands", type: "json", isNullable: true},
                    {name: "providers", type: "json", isNullable: true},
                    {name: "games", type: "json", isNullable: true},
                    {name: "jurisdictions", type: "json", isNullable: true},
                    {name: "key", type: "varchar"},
                    {name: "value", type: "varchar", isNullable: true},
                    {name: "priority", type: "integer"},
                    {name: "serverOnly", type: "boolean"},
                ],
                indices: [],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "settings", true);
    }
}
