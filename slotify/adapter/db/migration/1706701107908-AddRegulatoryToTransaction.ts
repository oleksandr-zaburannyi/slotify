import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddRegulatoryToTransaction1706701107908 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "regulatory", type: "jsonb", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", new TableColumn({name: "regulatory", type: "jsonb", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "regulatory");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", "regulatory");
    }
}
