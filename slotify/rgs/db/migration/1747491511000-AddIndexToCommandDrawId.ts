import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexToCommandDrawId1729969351000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists rgs_command_drawId_withdrawalStatus_bet_tickId on rgs_command("drawId", "withdrawalStatus", bet, "tickId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists rgs_command_drawId_withdrawalStatus_bet_tickId`);
    }
}
