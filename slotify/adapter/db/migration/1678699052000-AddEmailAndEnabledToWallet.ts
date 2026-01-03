import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddEmailAndEnabledToWallet1678699052000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "wallet", [new TableColumn({name: "enabled", type: "boolean", default: true}), new TableColumn({name: "email", type: "varchar", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wallet", "email");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wallet", "enabled");
    }
}
