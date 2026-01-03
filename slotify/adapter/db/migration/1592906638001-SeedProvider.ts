import {MigrationInterface, QueryRunner} from "typeorm";

export class SeedProvider1592906638001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const config = {
            realUrl: "https://cdn-${hostname}/${provider}/${game}/index.html?game=${game}&server=https://${hostname}&wallet=${wallet}&operator=${operator}&key=${key}",
            funUrl: "https://cdn-${hostname}/${provider}/${game}/index.html?game=${game}&server=https://${hostname}&wallet=demo&operator=${operator}",
            replayUrl: "https://cdn-${hostname}/${provider}/${game}/index.html?game=${game}&server=https://${hostname}&roundId=${roundId}",
            secretKey: process.env.ADAPTER_RGS_KEY || "secret-rgs-key",
        };
        await queryRunner.query(
            `INSERT INTO adapter_provider("id", "adapter", "config")
             VALUES ($1, $2, $3)`,
            [process.env.DEFAULT_RGS || "test-rgs", "standard", config],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM ${queryRunner.connection.options.entityPrefix + "provider"}`);
    }
}
