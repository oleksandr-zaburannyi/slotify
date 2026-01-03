import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCampaignState1654688610000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "campaign_state",
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "campaignId", type: "uuid", isNullable: true},
                    {name: "state", type: "json"},
                ],
                // foreignKeys: [
                //     {referencedTableName: queryRunner.connection.options.entityPrefix + "campaign", columnNames: ["campaignId"], referencedColumnNames: ["campaignId"]},
                // ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "campaign_state_campaignId", columnNames: ["campaignId"], isUnique: true}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "campaign_state", true);
    }
}
