import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class MovePlayerStatusToPlayerState1662479281000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "player_status");
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "player_state", [
            new TableColumn({name: "init", type: "boolean", isNullable: true}),
            new TableColumn({name: "optIn", type: "boolean", isNullable: true}),
            new TableColumn({name: "finished", type: "boolean", isNullable: true}),
            new TableColumn({name: "acknowledged", type: "boolean", isNullable: true}),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumns(queryRunner.connection.options.entityPrefix + "player_state", ["init", "optIn", "finished", "acknowledged"]);
    }
}
