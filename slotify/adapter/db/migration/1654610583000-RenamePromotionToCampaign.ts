import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class RenamePromotionToCampaign1654610583000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", new TableColumn({name: "campaignId", type: "varchar", isNullable: true}));
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "promotionType", "campaignType");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "promotionType", "campaignType");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "promotionId", "campaignId");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "campaignId");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "campaignType", "promotionType");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "campaignType", "promotionType");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "campaignId", "promotionId");
    }
}
