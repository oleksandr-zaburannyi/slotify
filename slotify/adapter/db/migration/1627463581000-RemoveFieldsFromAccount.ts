import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class RemoveFieldsFromAccount1627463581000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "provider");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "wallet");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "operator");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "brand");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction", [
            new TableColumn({name: "provider", type: "varchar", isNullable: true}),
            new TableColumn({name: "wallet", type: "varchar", isNullable: true}),
            new TableColumn({name: "operator", type: "varchar", isNullable: true}),
            new TableColumn({name: "brand", type: "varchar", isNullable: true}),
        ]);
    }
}
