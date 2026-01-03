import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class UpdateRtpMonitoringPermissions1696938566881 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const hasSettingsPermission = account.permissions?.includes("settings");
                if (hasSettingsPermission) {
                    account.permissions.push("rtpMonitoring");
                }

                const hasManageSettingsPermission = account.permissions?.includes("manageSettings");
                if (hasManageSettingsPermission) {
                    account.permissions.push("manageRtpMonitoring");
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
                const rtpMonitoringIndex = account.permissions?.indexOf("rtpMonitoring");
                if (rtpMonitoringIndex >= 0) {
                    account.permissions.splice(rtpMonitoringIndex, 1);
                }

                const manageRtpMonitoringIndex = account.permissions?.indexOf("manageRtpMonitoring");
                if (manageRtpMonitoringIndex >= 0) {
                    account.permissions.splice(manageRtpMonitoringIndex, 1);
                }

                if (rtpMonitoringIndex >= 0 || manageRtpMonitoringIndex >= 0) {
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
