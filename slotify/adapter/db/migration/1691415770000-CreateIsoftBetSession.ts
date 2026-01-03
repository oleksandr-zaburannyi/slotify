import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateIsoftBetSession1691415770000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "isoftbet_session",
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true},
                    {name: "nativeId", type: "varchar"},
                    {name: "provider", type: "varchar"},
                    {name: "game", type: "varchar"},
                    {name: "token", type: "varchar"},
                    {name: "lastActivity", type: "timestamptz"},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "isoftbet_session_lastActivity", columnNames: ["lastActivity"]},
                    {name: queryRunner.connection.options.entityPrefix + "isoftbet_session_nativeId_provider_game", columnNames: ["nativeId", "provider", "game"]},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "isoftbet_session", true);
    }
}
