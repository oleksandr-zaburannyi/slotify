import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCurrencyExchange1593162238000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "currency_exchange",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "date", type: "timestamp"},
                    {name: "currency", type: "varchar"},
                    {name: "rate", type: "numeric"},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "currency_exchange_date", columnNames: ["date"], isUnique: false},
                    {name: queryRunner.connection.options.entityPrefix + "currency_exchange_currency", columnNames: ["currency"], isUnique: false},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "currency_exchange", true);
    }
}
