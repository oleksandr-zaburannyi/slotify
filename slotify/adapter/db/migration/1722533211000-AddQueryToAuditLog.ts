import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddQueryToAuditLog1722533211000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "audit_log", [new TableColumn({name: "query", type: "varchar", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "audit_log", "query");
    }
}
