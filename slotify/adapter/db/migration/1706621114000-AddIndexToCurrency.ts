import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIndexToCurrency1706621114000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists adapter_currency_exchange_currency_date`);
        await queryRunner.query(`create index concurrently adapter_currency_exchange_currency_date on adapter_currency_exchange (currency, date DESC)`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists adapter_currency_exchange_currency_date`);
        await queryRunner.query(`create index concurrently adapter_currency_exchange_currency_date on adapter_currency_exchange (currency, date ASC)`);
    }
}
