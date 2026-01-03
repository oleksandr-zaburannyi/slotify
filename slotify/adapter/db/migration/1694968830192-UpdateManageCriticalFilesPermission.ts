import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class UpdateManageCriticalFilesPermission1694968830192 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const hasSettingsPermission = account.permissions?.includes("settings");
                if (hasSettingsPermission) {
                    account.permissions.push("criticalFiles");
                }

                const hasManageSettingsPermission = account.permissions?.includes("manageSettings");
                if (hasManageSettingsPermission) {
                    account.permissions.push("manageCriticalFiles");
                }

                if (hasSettingsPermission || hasManageSettingsPermission) {
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const criticalFilesIndex = account.permissions?.indexOf("criticalFiles");
                if (criticalFilesIndex >= 0) {
                    account.permissions.splice(criticalFilesIndex, 1);
                }

                const manageCriticalFilesIndex = account.permissions?.indexOf("manageCriticalFiles");
                if (manageCriticalFilesIndex >= 0) {
                    account.permissions.splice(manageCriticalFilesIndex, 1);
                }

                if (criticalFilesIndex >= 0 || manageCriticalFilesIndex >= 0) {
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
