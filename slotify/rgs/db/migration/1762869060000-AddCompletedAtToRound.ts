import {MigrationInterface, QueryRunner} from "typeorm";

export class AddCompletedAtToRound1762869060000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('alter table "rgs_round" add column if not exists "completedAt" timestamptz');
        await queryRunner.query('alter table "rgs_round_archive" add column if not exists "completedAt" timestamptz');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round", "completedAt");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round_archive", "completedAt");
    }
}
