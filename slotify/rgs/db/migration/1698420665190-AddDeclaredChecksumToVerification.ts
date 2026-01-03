import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddDeclaredChecksumToVerification1698420665190 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "critical_file_verification", new TableColumn({name: "declaredChecksum", isNullable: true, type: "varchar"}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "critical_file_verification", "declaredChecksum");
    }
}
