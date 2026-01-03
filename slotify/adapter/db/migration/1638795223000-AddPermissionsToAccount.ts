import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddPermissionsToAccount1638795223000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn(queryRunner.connection.options.entityPrefix + "account", "permissions")) return;
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "account", [new TableColumn({name: "permissions", type: "json", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "permissions");
    }
}
