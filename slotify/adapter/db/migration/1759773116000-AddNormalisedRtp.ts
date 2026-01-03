import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddNormalisedRtp1759773116000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "normalisedAmount", type: "decimal", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", new TableColumn({name: "normalisedAmount", type: "decimal", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", new TableColumn({name: "normalisedTotalBet", type: "decimal", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", new TableColumn({name: "normalisedTotalWin", type: "decimal", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "normalisedAmount");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", "normalisedAmount");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "normalisedTotalBet");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "normalisedTotalWin");
    }
}
