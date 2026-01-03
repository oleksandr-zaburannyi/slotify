import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddRgsToAccount1670703428000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "account", new TableColumn({name: "rgss", type: "json", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "rgss");
    }
}
