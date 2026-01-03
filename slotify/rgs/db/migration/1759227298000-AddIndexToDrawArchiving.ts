import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexToDrawArchiving1759227298000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_draw_finished_createdAt" on rgs_draw ("finished", "createdAt");`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_draw_finished_createdAt"`);
    }
}
