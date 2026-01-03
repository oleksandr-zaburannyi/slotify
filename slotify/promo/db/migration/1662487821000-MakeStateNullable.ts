import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class MakeStateNullable1662487821000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.changeColumn(queryRunner.connection.options.entityPrefix + "player_state", "state", new TableColumn({name: "state", type: "json", isNullable: true}));
        await queryRunner.changeColumn(queryRunner.connection.options.entityPrefix + "campaign_state", "state", new TableColumn({name: "state", type: "json", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.changeColumn(queryRunner.connection.options.entityPrefix + "player_state", "state", new TableColumn({name: "state", type: "json", isNullable: false}));
        await queryRunner.changeColumn(queryRunner.connection.options.entityPrefix + "campaign_state", "state", new TableColumn({name: "state", type: "json", isNullable: false}));
    }
}
