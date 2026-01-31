import {MigrationInterface, QueryRunner} from "typeorm";

export class AddWalletCampaignIdToTransaction1761420417000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('alter table "adapter_transaction" add column if not exists "walletCampaignId" varchar');
        await queryRunner.query('alter table "adapter_transaction_archive" add column if not exists "walletCampaignId" varchar');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "walletCampaignId");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", "walletCampaignId");
    }
}
