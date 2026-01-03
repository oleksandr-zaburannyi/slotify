import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCampaign1654688607000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "campaign",
                columns: [
                    {name: "campaignId", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "name", type: "varchar"},
                    {name: "type", type: "varchar"},
                    {name: "config", type: "json", isNullable: true},
                    {name: "start", type: "timestamptz", isNullable: true},
                    {name: "end", type: "timestamptz", isNullable: true},
                    {name: "enabled", type: "boolean", isNullable: true, default: "true"},
                    {name: "wallets", type: "jsonb", isNullable: true},
                    {name: "operators", type: "jsonb", isNullable: true},
                    {name: "brands", type: "jsonb", isNullable: true},
                    {name: "providers", type: "jsonb", isNullable: true},
                    {name: "games", type: "jsonb", isNullable: true},
                    {name: "playerIds", type: "jsonb", isNullable: true},
                    {name: "nativeIds", type: "jsonb", isNullable: true},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "campaign_name", isUnique: true, columnNames: ["name"]},
                    {name: queryRunner.connection.options.entityPrefix + "campaign_enabled_end", isUnique: false, columnNames: ["enabled", "end"]},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "campaign", true);
    }
}
