import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddReportExclusionFlags1758720526631 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "report_exclusion", new TableColumn({name: "inspection", type: "boolean", default: true, isNullable: false}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "report_exclusion", new TableColumn({name: "gameWin", type: "boolean", default: true, isNullable: false}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "report_exclusion", "gameWin");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "report_exclusion", "inspection");
    }
}
