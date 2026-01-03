import {MigrationInterface, QueryRunner} from "typeorm";

export class CreateRoundAndWagerArchive1705926779000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("create table rgs_wager_archive (like rgs_wager)");
        await queryRunner.query("create table rgs_round_archive (like rgs_round)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable("rgs_wager_archive");
        await queryRunner.dropTable("rgs_round_archive");
    }
}
