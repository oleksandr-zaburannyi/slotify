import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";

export class UpdateGamesPermission1695904453000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                if (account.permissions.includes("manageRgss")) {
                    account.permissions.push("manageGames");
                    account.permissions.push("games");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("manageGames");
                if (index >= 0) {
                    account.permissions.splice(index, 1);
                    await queryRunner.manager.save(account);
                }
                const index2 = account.permissions?.indexOf("gamesames");
                if (index2 >= 0) {
                    account.permissions.splice(index2, 1);
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
