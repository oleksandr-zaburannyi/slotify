import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class AddManageThemesPermission1752503873000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                if (account.permissions?.includes("manageCampaigns")) {
                    account.permissions.push("manageThemes");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const manageThemesPermissionIndex = account.permissions?.indexOf("manageThemes");
                if (manageThemesPermissionIndex >= 0) {
                    account.permissions.splice(manageThemesPermissionIndex, 1);
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
