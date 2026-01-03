import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class SeedCurrency1593172138001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const baseCurrency = process.env.BASE_CURRENCY!;
        await queryRunner.manager.query(
            `INSERT INTO rgs_currency (currency, "fixedRate")
             VALUES ('${baseCurrency}', 1)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.manager.query(`TRUNCATE rgs_currency`);
    }
}
