import {MigrationInterface, QueryRunner} from "typeorm";

export class AddUnprocessedSystemCommandIndex1757587095000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_system_command_roomId_id_unprocessed" ON rgs_system_command ("roomId", id) where processed is null`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_system_command_roomId_id_unprocessed"`);
    }
}
