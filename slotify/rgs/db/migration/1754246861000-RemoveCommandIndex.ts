import {MigrationInterface, QueryRunner} from "typeorm";

export class RemoveCommandIndex1754246861000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_command_roomId_processed_withdrawalStatus_id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        queryRunner.query(`create index concurrently if not exists "rgs_command_processed_roomId_withdrawalStatus_id" on rgs_command (processed, "roomId", "withdrawalStatus", id) where processed is NULL`).then(() => null);
    }
}
