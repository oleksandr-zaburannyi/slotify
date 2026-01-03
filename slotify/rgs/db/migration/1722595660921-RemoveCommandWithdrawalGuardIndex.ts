import {MigrationInterface, QueryRunner} from "typeorm";

export class RemoveCommandWithdrawalGuardIndex1722595660921 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rgs_command_roomId_playerId_action_withdrawalStatus"`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_command_roomId_playerId_action_withdrawalStatus" on rgs_command ("roomId", "playerId", "action", "withdrawalStatus")`);
    }
}
