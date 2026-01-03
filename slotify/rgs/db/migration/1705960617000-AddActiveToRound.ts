import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddActiveToRound1705960617000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round", new TableColumn({name: "active", isNullable: true, type: "boolean"}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round_archive", new TableColumn({name: "active", isNullable: true, type: "boolean"}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round", "active");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round_archive", "active");
    }
}
