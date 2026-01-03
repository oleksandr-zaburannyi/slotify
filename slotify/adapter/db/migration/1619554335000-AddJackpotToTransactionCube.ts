import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddJackpotToTransactionCube1619554335000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction_cube", [
            new TableColumn({name: "jackpotContribution", type: "decimal", isNullable: true}),
            new TableColumn({name: "jackpotWin", type: "decimal", isNullable: true}),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "jackpotContribution");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "jackpotWin");
    }
}
