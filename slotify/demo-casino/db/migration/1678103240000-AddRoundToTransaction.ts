import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddRoundToTransaction1678103240000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction", [
            new TableColumn({name: "roundId", type: "varchar", isNullable: true}),
            new TableColumn({name: "roundFinished", type: "boolean", isNullable: true}),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumns(queryRunner.connection.options.entityPrefix + "transaction", ["roundId", "roundFinished"]);
    }
}
