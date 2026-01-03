import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddWinRatioToTransaction1666604034000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "winRatio", isNullable: true, type: "numeric"}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "winRatio");
    }
}
