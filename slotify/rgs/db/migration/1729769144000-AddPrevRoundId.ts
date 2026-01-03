import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddPrevRoundId1729769144000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round", new TableColumn({name: "prevRoundId", type: "uuid", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round_archive", new TableColumn({name: "prevRoundId", type: "uuid", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round", "prevRoundId");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round_archive", "prevRoundId");
    }
}
