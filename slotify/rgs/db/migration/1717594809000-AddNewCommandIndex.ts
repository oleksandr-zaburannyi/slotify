import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddNewCommandIndex1717594809000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_command_roomId_playerId_action_withdrawalStatus" on rgs_command ("roomId", "playerId", "action", "withdrawalStatus")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rgs_command_roomId_playerId_action_withdrawalStatus"`);
    }
}
