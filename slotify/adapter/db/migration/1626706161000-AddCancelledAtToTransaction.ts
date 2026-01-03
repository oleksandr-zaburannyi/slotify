import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddCancelledAtToTransaction1626706161000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "cancelledAt", type: "timestamptz", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "cancelledAt");
    }
}
