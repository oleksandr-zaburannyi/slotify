import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddSftpToReportReceiver1758720526631 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "report_receiver", new TableColumn({name: "sftp", type: "json", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "report_receiver", "sftp");
    }
}
