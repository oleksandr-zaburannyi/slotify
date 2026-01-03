import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCampaignPrize1661422848000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "campaign_prize",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "campaignId", type: "uuid"},
                    {name: "playerId", type: "varchar"},
                    {name: "type", type: "varchar"},
                    {name: "data", type: "json"},
                    {name: "paid", type: "boolean"},
                ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "campaign_prize_campaignId", columnNames: ["campaignId"]}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "campaign_prize", true);
    }
}
