import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";
import {Currency} from "../model/Currency";

export class AddArsblueCurrency1709660910000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.manager.query(
            `INSERT INTO rgs_currency (currency, "fixedRate", symbol)
             VALUES ('arsblue', 1000, 'ars')`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.manager.delete(Currency, {currency: "arsblue"});
    }
}
