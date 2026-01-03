import {MigrationInterface, QueryRunner} from "typeorm";

export class AddProcessedToFailedCommands1753519848000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_command_roomId_processed_withdrawalStatus_id"`);
        queryRunner
            .query(
                `update rgs_command
                 set processed = false
                 where "withdrawalStatus" IN ('cancelled', 'failed')
                   and processed is NULL`,
            )
            .then(() => null);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        queryRunner
            .query(
                `update rgs_command
                 set processed = NULL
                 where "withdrawalStatus" IN ('cancelled', 'failed')
                   and processed = false`,
            )
            .then(() => null);
    }
}
