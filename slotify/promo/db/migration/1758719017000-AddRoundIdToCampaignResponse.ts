import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddRoundIdToCampaignResponse1758719017000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(
            queryRunner.connection.options.entityPrefix + "campaign_response",
            new TableColumn({
                name: "roundId",
                type: "uuid",
                isNullable: true,
            }),
        );
        await queryRunner.query(`CREATE INDEX "promo_campaign_response_round_access" ON "promo_campaign_response" ("roundId") WHERE "roundId" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "campaign_response", "roundId");
        await queryRunner.dropIndex(queryRunner.connection.options.entityPrefix + "campaign_response", "promo_campaign_response_round_access");
    }
}
