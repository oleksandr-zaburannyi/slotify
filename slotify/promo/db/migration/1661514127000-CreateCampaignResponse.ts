import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCampaignResponse1661514127000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "campaign_response",
                columns: [
                    {name: "responseId", type: "varchar", isPrimary: true, isGenerated: false},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "response", type: "jsonb"},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "campaign_response", true);
    }
}
