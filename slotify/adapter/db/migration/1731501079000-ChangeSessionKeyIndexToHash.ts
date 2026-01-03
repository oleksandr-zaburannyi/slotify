import {MigrationInterface, QueryRunner} from "typeorm";

export class ChangeSessionKeyIndexToHash1731501079000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists adapter_session_key on adapter_session using hash (key)`);
        await queryRunner.query(`drop index concurrently if exists adapter_session_key_active;`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "adapter_session_key"`);
        await queryRunner.query(`create index concurrently if not exists adapter_session_key_active on adapter_session (key, active)`);
    }
}
