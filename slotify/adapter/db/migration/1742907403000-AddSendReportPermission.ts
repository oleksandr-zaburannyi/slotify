import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class AddSendReportPermission1742907403000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                if (account.permissions?.includes("manageAccounts")) {
                    account.permissions.push("reportSender");
                    account.permissions.push("manageReportSender");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const reportSenderPermissionIndex = account.permissions?.indexOf("reportSender");
                if (reportSenderPermissionIndex >= 0) {
                    account.permissions.splice(reportSenderPermissionIndex, 1);
                    await queryRunner.manager.save(account);
                }
                const manageReportSenderPermissionIndex = account.permissions?.indexOf("manageReportSender");
                if (manageReportSenderPermissionIndex >= 0) {
                    account.permissions.splice(manageReportSenderPermissionIndex, 1);
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
