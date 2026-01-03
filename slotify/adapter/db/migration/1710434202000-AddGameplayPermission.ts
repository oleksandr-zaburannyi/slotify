import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class AddGameplayPermission1710434202000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const roundPermissionIndex = account.permissions?.indexOf("rounds");
                if (roundPermissionIndex >= 0) {
                    account.permissions.splice(roundPermissionIndex, 1);
                }

                const wagersPermissionsIndex = account.permissions?.indexOf("wagers");
                if (wagersPermissionsIndex >= 0) {
                    account.permissions.splice(wagersPermissionsIndex, 1);
                }

                if (roundPermissionIndex >= 0 || wagersPermissionsIndex >= 0) {
                    account.permissions.push("gameplay");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const gameplayPermissionIndex = account.permissions?.indexOf("gameplay");
                if (gameplayPermissionIndex >= 0) {
                    account.permissions.splice(gameplayPermissionIndex, 1);
                    account.permissions.push("rounds");
                    account.permissions.push("wagers");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
