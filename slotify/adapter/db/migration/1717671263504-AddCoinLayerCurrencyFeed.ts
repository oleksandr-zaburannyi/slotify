import {MigrationInterface, QueryRunner} from "typeorm";
import {CurrencyFeed} from "../model/CurrencyFeed";

const cryptoCurrencies = ["btc", "eth", "ltc", "doge", "trx", "xrp", "bch", "ppc", "usdt", "xrp", "bnb", "ada", "trx"];

export class AddCoinLayerCurrencyFeed1717671263504 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.manager.insert(CurrencyFeed, {feed: "coinLayer", enabled: false, currencies: cryptoCurrencies, config: {secretKey: "enter-your-secret-key"} as any});
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.manager.delete(CurrencyFeed, {feed: "coinLayer"});
    }
}
