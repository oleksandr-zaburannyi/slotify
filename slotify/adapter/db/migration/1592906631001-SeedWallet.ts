import {MigrationInterface, QueryRunner} from "typeorm";

export class SeedWallet1592906631001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            `INSERT INTO "adapter_wallet"("id", "adapter", "config")
             VALUES ($1, $2, $3)`,
            ["demo", "standard", {"url": "http://demo-casino", "secretKey": "demo-secret"}],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM ${queryRunner.connection.options.entityPrefix + "wallet"}`);
    }
}
