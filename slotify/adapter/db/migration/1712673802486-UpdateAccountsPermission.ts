import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class UpdateAccountsPermission1712673802486 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("clearTransactionCube");
                if (index >= 0) {
                    account.permissions.splice(index, 1);
                    account.permissions.push("regenerateGameWin");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("regenerateGameWin");
                if (index >= 0) {
                    account.permissions.splice(index, 1);
                    account.permissions.push("clearTransactionCube");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
