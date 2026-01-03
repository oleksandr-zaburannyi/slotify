import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class RemoveSideBetsWins1701249603000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumns(queryRunner.connection.options.entityPrefix + "wager", ["sideWins", "sideBets"]);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "wager", [new TableColumn({name: "sideBets", isNullable: true, type: "json"}), new TableColumn({name: "sideWins", isNullable: true, type: "json"})]);
    }
}
