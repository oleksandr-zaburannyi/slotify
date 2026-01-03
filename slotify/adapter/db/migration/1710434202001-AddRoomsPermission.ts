import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class AddRoomsPermission1710434202000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const hasGamesPermission = account.permissions?.includes("games");
                if (hasGamesPermission) {
                    account.permissions.push("rooms");
                }

                const hasManageGamesPermission = account.permissions?.includes("manageGames");
                if (hasManageGamesPermission) {
                    account.permissions.push("manageRooms");
                }

                if (hasGamesPermission || hasManageGamesPermission) {
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const roomsIndex = account.permissions?.indexOf("rooms");
                if (roomsIndex >= 0) {
                    account.permissions.splice(roomsIndex, 1);
                }

                const manageRoomsIndex = account.permissions?.indexOf("manageRooms");
                if (manageRoomsIndex >= 0) {
                    account.permissions.splice(manageRoomsIndex, 1);
                }

                if (roomsIndex >= 0 || manageRoomsIndex >= 0) {
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
