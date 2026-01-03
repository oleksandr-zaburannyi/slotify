import {MigrationInterface, QueryRunner} from "typeorm";

export class UpdateNativeIdInPlayer1764074025142 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const playerTable = queryRunner.connection.options.entityPrefix + "player";
        const walletTable = queryRunner.connection.options.entityPrefix + "wallet";

        await queryRunner.query(`
            UPDATE ${playerTable} p
            SET "nativeId" = p."nativeId" || '_' || p."brand"
            FROM ${walletTable} w
            WHERE p.wallet = w.id
              AND w.adapter = 'lnw'
              AND p."brand" IS NOT NULL
              AND RIGHT(p."nativeId", length(p."brand") + 1) != ('_' || p."brand")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const playerTable = queryRunner.connection.options.entityPrefix + "player";
        const walletTable = queryRunner.connection.options.entityPrefix + "wallet";

        await queryRunner.query(`
            UPDATE ${playerTable} p
            SET "nativeId" = LEFT(p."nativeId", length(p."nativeId") - length(p."brand") - 1)
            FROM ${walletTable} w
            WHERE p.wallet = w.id
              AND w.adapter = 'lnw'
              AND p."brand" IS NOT NULL
              AND RIGHT(p."nativeId", length(p."brand") + 1) = ('_' || p."brand")
        `);
    }
}
