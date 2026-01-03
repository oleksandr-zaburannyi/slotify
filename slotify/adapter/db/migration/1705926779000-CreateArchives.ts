import {MigrationInterface, QueryRunner} from "typeorm";

export class CreateRoundAndWagerArchive1705926779000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("create table adapter_transaction_archive (like adapter_transaction)");
        await queryRunner.query("create table adapter_session_archive (like adapter_session)");
        await queryRunner.query("create table adapter_round_verification_archive (like adapter_round_verification)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable("adapter_transaction_archive");
        await queryRunner.dropTable("adapter_session_archive");
        await queryRunner.dropTable("adapter_round_verification_archive");
    }
}
