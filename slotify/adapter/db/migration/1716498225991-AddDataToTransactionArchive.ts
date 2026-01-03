import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddDataToTransactionArchive1716498225991 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", new TableColumn({name: "data", type: "jsonb", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", "data");
    }
}
