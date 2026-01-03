import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddActiveSessionToAccount1668978332000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "account", [new TableColumn({name: "activeSession", type: "boolean", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "activeSession");
    }
}
