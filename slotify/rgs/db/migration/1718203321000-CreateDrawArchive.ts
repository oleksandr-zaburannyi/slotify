import {MigrationInterface, QueryRunner} from "typeorm";

export class CreateDrawArchive1718203321000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("create table rgs_draw_archive (like rgs_draw)");
        await queryRunner.query("create table rgs_draw_win_archive (like rgs_draw_win)");
        await queryRunner.query("create table rgs_command_archive (like rgs_command)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable("rgs_draw_archive");
        await queryRunner.dropTable("rgs_draw_win_archive");
        await queryRunner.dropTable("rgs_command_archive");
    }
}
