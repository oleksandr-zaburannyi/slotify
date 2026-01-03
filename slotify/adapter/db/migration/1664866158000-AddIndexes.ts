import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIndexes1664866158000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index if not exists "adapter_currency_exchange_currency_date" on adapter_currency_exchange ("currency", "date")`);
        await queryRunner.query(`create index if not exists "adapter_currency_exchange_currency_date_day" on adapter_currency_exchange ("currency", date_trunc('day', "date"))`);
        await queryRunner.query(`create index if not exists "adapter_currency_exchange_currency_date_month" on adapter_currency_exchange ("currency", date_trunc('month', "date"))`);
        await queryRunner.query(`create index if not exists "adapter_currency_exchange_currency_date_year" on adapter_currency_exchange ("currency", date_trunc('year', "date"))`);
        await queryRunner.query(`create index if not exists "adapter_audit_log_date" on adapter_audit_log ("date")`);
        await queryRunner.query(`create index if not exists "adapter_transaction_cube_date_empty" on adapter_transaction_cube ("date", "empty")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "adapter_currency_exchange_currency_date"`);
        await queryRunner.query(`drop index if exists "adapter_currency_exchange_currency_date_day"`);
        await queryRunner.query(`drop index if exists "adapter_currency_exchange_currency_date_month"`);
        await queryRunner.query(`drop index if exists "adapter_currency_exchange_currency_date_year"`);
        await queryRunner.query(`drop index if exists "adapter_audit_log_date"`);
        await queryRunner.query(`drop index if exists "adapter_transaction_cube_date_empty"`);
    }
}
