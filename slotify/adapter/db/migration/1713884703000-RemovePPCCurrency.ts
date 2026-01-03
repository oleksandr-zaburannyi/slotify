import {MigrationInterface, QueryRunner} from "typeorm";
import {CurrencyFeed} from "../model/CurrencyFeed";

export class RemovePPCCurrency1713884703000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const feed = await queryRunner.manager.findOneBy(CurrencyFeed, {feed: "coinAPI"});
        if (feed) {
            feed.currencies = feed.currencies.filter(currency => currency !== "ppc");
            await queryRunner.manager.save(feed);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const feed = await queryRunner.manager.findOneBy(CurrencyFeed, {feed: "coinAPI"});
        if (feed) {
            feed.currencies.push("ppc");
            await queryRunner.manager.save(feed);
        }
    }
}
