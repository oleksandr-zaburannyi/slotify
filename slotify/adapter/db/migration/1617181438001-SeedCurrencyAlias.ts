import {MigrationInterface, QueryRunner} from "typeorm";
import {CurrencyAlias} from "../model/CurrencyAlias";

export class SeedCurrencyAlias1617181438001 implements MigrationInterface {
    public async up(): Promise<void> {
        await CurrencyAlias.create({currency: "btc", alias: "mbtc", multiplier: 0.001}).save();
        await CurrencyAlias.create({currency: "btc", alias: "ubtc", multiplier: 0.000001}).save();
        await CurrencyAlias.create({currency: "eth", alias: "meth", multiplier: 0.001}).save();
        await CurrencyAlias.create({currency: "eth", alias: "ueth", multiplier: 0.000001}).save();
        await CurrencyAlias.create({currency: "vnd", alias: "kvnd", multiplier: 1000}).save();
        await CurrencyAlias.create({currency: "idr", alias: "kidr", multiplier: 1000}).save();
        await CurrencyAlias.create({currency: "vnd", alias: "mvnd", multiplier: 1000}).save(); //for azuretech
        await CurrencyAlias.create({currency: "idr", alias: "midr", multiplier: 1000}).save(); //for azuretech
        await CurrencyAlias.create({currency: "doge", alias: "dog", multiplier: 1}).save(); //for softswiss
        await CurrencyAlias.create({currency: "bnb", alias: "mbnb", multiplier: 0.001}).save(); //for softswiss
        await CurrencyAlias.create({currency: "ltc", alias: "mltc", multiplier: 0.001}).save(); //for softswiss
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM ${queryRunner.connection.options.entityPrefix + "currency_alias"}`);
    }
}
