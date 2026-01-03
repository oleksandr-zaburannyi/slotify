import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexToTransaction1758891378000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`create index concurrently if not exists "adapter_transaction_cancelledAt" on adapter_transaction ("cancelledAt") where "status" = 'cancelled'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index concurrently if exists adapter_transaction_cancelledAt`);
    }
}
