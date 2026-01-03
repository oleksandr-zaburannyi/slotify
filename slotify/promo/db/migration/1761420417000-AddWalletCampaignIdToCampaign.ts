import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddWalletCampaignIdToCampaign1761420417000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "campaign", [new TableColumn({name: "walletCampaignId", type: "varchar", isNullable: true})]);

        await queryRunner.query(`create index concurrently if not exists "promo_campaign_walletCampaignId" on promo_campaign ("walletCampaignId") where "walletCampaignId" is not null;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "campaign", "walletCampaignId");
    }
}
