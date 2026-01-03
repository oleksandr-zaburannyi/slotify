import {MigrationInterface, TableColumn, TableIndex} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddStepToWager1658593613000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "wager", new TableColumn({name: "step", isNullable: true, type: "integer"}));
        await queryRunner.createIndex(queryRunner.connection.options.entityPrefix + "wager", new TableIndex({name: "rgs_wager_roundId_step", isUnique: true, columnNames: ["roundId", "step"]}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wager", "step");
        await queryRunner.dropIndex(queryRunner.connection.options.entityPrefix + "wager", "rgs_wager_roundId_step");
    }
}
