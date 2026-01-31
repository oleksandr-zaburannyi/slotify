import {MigrationInterface, QueryRunner} from "typeorm";
import {CurrencyFeed} from "../model/CurrencyFeed";

export class RemoveBgnFromEcbCurrencyFeed1767463550289 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const feed = await queryRunner.manager.findOneBy(CurrencyFeed, {feed: "ecb"});
        if (feed) {
            feed.currencies = feed.currencies.filter(currency => currency !== "bgn");
            await queryRunner.manager.save(feed);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const feed = await queryRunner.manager.findOneBy(CurrencyFeed, {feed: "ecb"});
        if (feed && !feed.currencies.includes("bgn")) {
            feed.currencies.push("bgn");
            await queryRunner.manager.save(feed);
        }
    }
}
