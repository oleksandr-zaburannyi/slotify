import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddLoggedChecksumToCriticalFile1698424141556 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const tableName = queryRunner.connection.options.entityPrefix + "critical_file";
        await queryRunner.addColumn(tableName, new TableColumn({name: "loggedChecksum", isNullable: true, type: "varchar"}));
        await queryRunner.renameColumn(tableName, "checksum", "declaredChecksum");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        const tableName = queryRunner.connection.options.entityPrefix + "critical_file";
        await queryRunner.dropColumn(tableName, "loggedChecksum");
        await queryRunner.renameColumn(tableName, "declaredChecksum", "checksum");
    }
}
