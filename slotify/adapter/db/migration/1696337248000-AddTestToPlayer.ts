import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";
import {Account} from "../model/Account";

export class AddTestToPlayer1696337248000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "player", new TableColumn({name: "test", type: "boolean", isNullable: true}));

        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                if (account.permissions.includes("blockPlayer")) {
                    account.permissions.push("setTestPlayer");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "player", "test");

        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("setTestPlayer");
                if (index >= 0) {
                    account.permissions.splice(index, 1);
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
