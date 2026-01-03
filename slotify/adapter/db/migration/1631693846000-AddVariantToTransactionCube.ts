import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddVariantToTransactionCube1631693846000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", new TableColumn({name: "variant", isNullable: true, type: "varchar"}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "variant");
    }
}
