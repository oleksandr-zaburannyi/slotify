import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class UpdateManageCurrencyPermission1689677875000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("manageCurrencyAliases");
                if (index >= 0) {
                    account.permissions[index] = "manageCurrencies";
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("manageCurrencies");
                if (index >= 0) {
                    account.permissions[index] = "manageCurrencyAliases";
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
