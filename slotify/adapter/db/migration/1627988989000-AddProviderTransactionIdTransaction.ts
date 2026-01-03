import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddProviderTransactionIdTransaction1627988989000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "providerTransactionId", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "providerTransactionId");
    }
}
