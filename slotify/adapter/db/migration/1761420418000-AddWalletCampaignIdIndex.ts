import {MigrationInterface, QueryRunner} from "typeorm";

export class AddWalletCampaignIdIndex1761420418000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`create index concurrently if not exists "adapter_transaction_walletCampaignId" on adapter_transaction ("walletCampaignId") where "walletCampaignId" is not null`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index concurrently if exists "adapter_transaction_walletCampaignId"`);
    }
}
