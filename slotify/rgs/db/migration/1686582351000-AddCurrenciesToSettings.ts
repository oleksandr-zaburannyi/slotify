import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddCurrenciesToSettings1686582351000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "settings", new TableColumn({name: "currencies", isNullable: true, type: "json"}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "settings", "currencies");
    }
}
