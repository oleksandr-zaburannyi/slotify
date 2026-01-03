import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddCampaignDataToTransaction1761420416000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction", [new TableColumn({name: "campaignData", type: "jsonb", isNullable: true})]);
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction_archive", [new TableColumn({name: "campaignData", type: "jsonb", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "campaignData");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", "campaignData");
    }
}
