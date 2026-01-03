import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddFieldsToAccount1623262635000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "account", [
            new TableColumn({name: "providers", type: "json", isNullable: true}),
            new TableColumn({name: "wallets", type: "json", isNullable: true}),
            new TableColumn({name: "operators", type: "json", isNullable: true}),
            new TableColumn({name: "brands", type: "json", isNullable: true}),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "providers");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "wallets");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "operators");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "brands");
    }
}
