import {MigrationInterface, QueryRunner} from "typeorm";
import {CurrencyFeed} from "../model/CurrencyFeed";

export class AddBluelyticsCurrencyFeed1709654546000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.manager.insert(CurrencyFeed, {feed: "bluelytics", enabled: true, currencies: ["arsblue"], config: {}});
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.manager.delete(CurrencyFeed, {feed: "bluelytics"});
    }
}
