import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class UpdateManagePlayerPermissions1708694822000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const blockPlayerIndex = account.permissions?.indexOf("blockPlayer");
                if (blockPlayerIndex >= 0) {
                    account.permissions.splice(blockPlayerIndex, 1);
                }
                const setTestPlayerIndex = account.permissions?.indexOf("setTestPlayer");
                if (setTestPlayerIndex >= 0) {
                    account.permissions.splice(setTestPlayerIndex, 1);
                }
                if (blockPlayerIndex >= 0 || setTestPlayerIndex >= 0) {
                    account.permissions?.push("managePlayers");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("managePlayers");
                if (index >= 0) {
                    account.permissions.splice(index, 1);
                }
                if (index >= 0) {
                    account.permissions?.push("managePlayers");
                    account.permissions?.push("setTestPlayer");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
