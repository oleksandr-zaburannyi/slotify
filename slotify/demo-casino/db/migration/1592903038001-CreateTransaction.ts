import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreatePlayer1592903038001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "transaction",
                columns: [
                    {name: "transactionId", type: "varchar", isPrimary: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "type", type: "varchar"},
                    {name: "amount", type: "numeric"},
                    {name: "cancelled", type: "boolean", default: false},
                ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "transaction_updatedAt", columnNames: ["updatedAt"], isUnique: false}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "transaction", true);
    }
}
