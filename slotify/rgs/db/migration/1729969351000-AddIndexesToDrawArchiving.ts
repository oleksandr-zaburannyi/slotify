import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexesToDrawArchiving1729969351000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_draw_win_drawId" on rgs_draw_win ("drawId");`);
        await queryRunner.query(`create index concurrently if not exists "rgs_draw_createdAt_finished" on rgs_draw ("createdAt", "finished");`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_draw_win_drawId"`);
        await queryRunner.query(`drop index concurrently if exists "rgs_draw_createdAt_finished"`);
    }
}
