import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddIpsToAccount1662626621000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "account", [new TableColumn({name: "ips", type: "json", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "ips");
    }
}
