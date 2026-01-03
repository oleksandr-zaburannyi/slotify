import {MigrationInterface, QueryRunner} from "typeorm";
import {CurrencyFeed} from "../model/CurrencyFeed";

export class AddSMCVenezuelaCurrencyFeed1754475371000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.manager.insert(CurrencyFeed, {feed: "SMCVenezuela", enabled: false, currencies: ["ves2"], config: {}});
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.manager.delete(CurrencyFeed, {feed: "SMCVenezuela"});
    }
}
