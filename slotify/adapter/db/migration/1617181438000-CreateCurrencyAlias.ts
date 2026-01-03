import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCurrencyAlias1617181438000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "currency_alias",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "currency", type: "varchar"},
                    {name: "alias", type: "varchar"},
                    {name: "multiplier", type: "numeric"},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "currency_alias", true);
    }
}
