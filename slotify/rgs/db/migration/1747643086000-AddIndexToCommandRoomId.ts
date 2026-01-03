import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexToCommandRoomId1747643086000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists rgs_command_roomId_processed_withdrawalStatus on rgs_command ("roomId", "processed", "withdrawalStatus")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists rgs_command_roomId_processed_withdrawalStatus`);
    }
}
