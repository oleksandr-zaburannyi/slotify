import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddIpsToWalletAndRGS1672660891000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "wallet", [new TableColumn({name: "ips", type: "json", isNullable: true})]);
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "rgs", [new TableColumn({name: "ips", type: "json", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wallet", "ips");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "rgs", "ips");
    }
}
