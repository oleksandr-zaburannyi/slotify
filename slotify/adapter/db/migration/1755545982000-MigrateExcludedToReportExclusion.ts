import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class MigrateExcludedToReportExclusion1755545982000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO adapter_report_exclusion (
                "createdAt",
                "updatedAt",
                "nativeId",
                "wallet",
                "comment"
            )
            SELECT
                p."createdAt",
                p."updatedAt",
                p."nativeId",
                p.wallet,
                'Migrated from player.excluded field'
            FROM adapter_player p
            WHERE p.excluded = true
        `);
        await queryRunner.dropColumn("adapter_player", "excluded");

        await queryRunner.query(`
            INSERT INTO adapter_report_exclusion (
                "wallet",
                "comment"
            )
            SELECT
                w.id,
                'Migrated from wallet.excluded field'
            FROM adapter_wallet w
            WHERE w.excluded = true
        `);
        await queryRunner.dropColumn("adapter_wallet", "excluded");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "adapter_player",
            new TableColumn({
                name: "excluded",
                type: "boolean",
                isNullable: true,
            }),
        );
        await queryRunner.query(`
            UPDATE adapter_player
            SET excluded = true
            WHERE ("nativeId", wallet) IN (
                SELECT DISTINCT "nativeId", "wallet"
                FROM adapter_report_exclusion
                WHERE "nativeId" IS NOT NULL AND "wallet" IS NOT NULL
            )
        `);

        await queryRunner.addColumn(
            "adapter_wallet",
            new TableColumn({
                name: "excluded",
                type: "boolean",
                isNullable: true,
            }),
        );
        await queryRunner.query(`
            UPDATE adapter_wallet
            SET excluded = true
            WHERE id IN (
                SELECT DISTINCT "wallet"
                FROM adapter_report_exclusion
                WHERE "wallet" IS NOT NULL AND "playerId" IS NULL AND "nativeId" IS NULL
            )
        `);

        await queryRunner.clearTable("adapter_report_exclusion");
    }
}
