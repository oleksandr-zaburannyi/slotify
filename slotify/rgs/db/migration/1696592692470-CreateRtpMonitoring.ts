import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateRtpMonitoring1696592692470 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = queryRunner.connection.options.entityPrefix + "rtp_monitoring";
        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "game", type: "varchar"},
                    {name: "variant", type: "varchar", isNullable: true},
                    {name: "declaredRtp", type: "numeric"},
                    {name: "calculus", type: "jsonb", isNullable: true},
                    {name: "sampleCount", type: "numeric"},
                    {name: "sampleRtp", type: "numeric", isNullable: true},
                    {name: "sampleVariance", type: "numeric", isNullable: true},
                    {name: "sampleMarginOfError", type: "numeric", isNullable: true},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "rtp_monitoring", true);
    }
}
