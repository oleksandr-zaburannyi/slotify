import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddReportReceiver1742827011000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: "adapter_report_receiver",
                columns: [
                    {name: "id", type: "integer", isGenerated: true, isPrimary: true},
                    {name: "cron", type: "varchar"},
                    {name: "report", type: "varchar"},
                    {name: "account", type: "varchar"},
                    {name: "email", type: "varchar"},
                    {name: "variables", type: "json", isNullable: true},
                ],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable("adapter_report_receiver");
    }
}
