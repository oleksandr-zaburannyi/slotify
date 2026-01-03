import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateTransactionCube1618481031000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "transaction_cube",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "date", type: "timestamptz", isNullable: true},
                    {name: "game", type: "varchar", isNullable: true},
                    {name: "currency", type: "varchar", isNullable: true},
                    {name: "wallet", type: "varchar", isNullable: true},
                    {name: "operator", type: "varchar", isNullable: true},
                    {name: "brand", type: "varchar", isNullable: true},
                    {name: "provider", type: "varchar", isNullable: true},
                    {name: "category", type: "varchar", isNullable: true},
                    {name: "name", type: "varchar", isNullable: true},
                    {name: "promotionType", type: "varchar", isNullable: true},
                    {name: "promotionId", type: "varchar", isNullable: true},
                    {name: "empty", type: "boolean", isNullable: true},
                    {name: "withdrawals", type: "numeric", isNullable: true},
                    {name: "deposits", type: "numeric", isNullable: true},
                    {name: "rounds", type: "integer", isNullable: true},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "transaction_cube", true);
    }
}
