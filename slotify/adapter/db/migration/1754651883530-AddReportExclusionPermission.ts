import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class AddReportExclusionPermission1754651883530 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                if (account.permissions?.includes("manageAccounts")) {
                    account.permissions.push("reportExclusion");
                    account.permissions.push("manageReportExclusion");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const reportExclusionPermissionIndex = account.permissions?.indexOf("reportExclusion");
                if (reportExclusionPermissionIndex >= 0) {
                    account.permissions.splice(reportExclusionPermissionIndex, 1);
                    await queryRunner.manager.save(account);
                }
                const manageReportExclusionPermissionIndex = account.permissions?.indexOf("manageReportExclusion");
                if (manageReportExclusionPermissionIndex >= 0) {
                    account.permissions.splice(manageReportExclusionPermissionIndex, 1);
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
