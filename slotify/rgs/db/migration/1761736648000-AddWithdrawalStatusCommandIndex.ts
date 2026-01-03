import {MigrationInterface, QueryRunner} from "typeorm";

export class AddWithdrawalStatusCommandIndex1761736648000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_command_withdrawalStatus" ON rgs_command ("withdrawalStatus") where "withdrawalStatus" in ('failed', 'finishing')`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_command_withdrawalStatus"`);
    }
}
