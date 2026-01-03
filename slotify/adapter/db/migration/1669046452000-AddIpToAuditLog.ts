import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddIpToAuditLog1669046452000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "audit_log", [
            new TableColumn({name: "ip", type: "varchar", isNullable: true}),
            new TableColumn({name: "isIpWhitelisted", type: "boolean", isNullable: true}),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "audit_log", "ip");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "audit_log", "isIpWhitelisted");
    }
}
