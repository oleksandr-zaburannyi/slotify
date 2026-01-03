import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCampaignLog1669713647000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "campaign_log",
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "campaignId", type: "uuid"},
                    {name: "name", type: "varchar"},
                    {name: "data", type: "jsonb"},
                ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "campaign_log_campaignId", columnNames: ["campaignId"]}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "campaign_log", true);
    }
}
