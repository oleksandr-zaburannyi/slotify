import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class SeedAccount1596877438001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const permissions = [
            "availableBets",
            "campaigns",
            "manageCampaigns",
            "auditLogs",
            "wallets",
            "rgss",
            "accounts",
            "players",
            "transactions",
            "gameWin",
            "currencyExchange",
            "currencyAliases",
            "manageAccounts",
            "manageCurrencyAliases",
            "manageRgss",
            "manageWallets",
            "closeTransaction",
            "settings",
            "rounds",
            "wagers",
            "fixedCurrencyRates",
            "manageSettings",
            "verifier",
            "clearTransactionCube",
            "graphiql",
            "blockPlayer",
        ];
        await queryRunner.query(
            `INSERT INTO "adapter_account"("email", "password", "permissions")
             VALUES ($1, $2, $3)`,
            ["contact@tequity.ventures", Account.hashPassword("admin"), JSON.stringify(permissions)],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM ${queryRunner.connection.options.entityPrefix + "account"}`);
    }
}
