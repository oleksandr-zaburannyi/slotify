import {MigrationInterface, QueryRunner} from "typeorm";
import {Account} from "../model/Account";
import {Table} from "typeorm/schema-builder/table/Table";

export class CreateSession1695986863000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "player_token", true);
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "session",
                columns: [
                    {name: "sessionId", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "lastActivity", type: "timestamptz"},
                    {name: "endedAt", type: "timestamptz", isNullable: true},
                    {name: "lastFail", type: "timestamptz", isNullable: true},
                    {name: "playerId", type: "uuid"},
                    {name: "token", type: "varchar"},
                    {name: "game", type: "varchar", isNullable: true},
                    {name: "provider", type: "varchar", isNullable: true},
                    {name: "active", type: "boolean"},
                    {name: "ip", type: "varchar", isNullable: true},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "session_playerId_provider_game_lastActivity", columnNames: ["playerId", "provider", "game", "lastActivity"]},
                    {name: queryRunner.connection.options.entityPrefix + "session_playerId_provider_game_active", columnNames: ["playerId", "provider", "game", "active"], where: "active = true", isUnique: true},
                    {name: queryRunner.connection.options.entityPrefix + "session_lastActivity_lastFail", columnNames: ["lastActivity", "lastFail"], where: "active = true"},
                ],
            }),
            true,
        );

        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                if (account.permissions.includes("players")) {
                    account.permissions.push("sessions");
                    account.permissions.push("endSession");
                    await queryRunner.manager.save(account);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "session", true);
        const accounts = await queryRunner.manager.find(Account);
        for (const account of accounts) {
            if (account.permissions) {
                const index = account.permissions?.indexOf("sessions");
                if (index >= 0) {
                    account.permissions.splice(index, 1);
                    await queryRunner.manager.save(account);
                }
                const index2 = account.permissions?.indexOf("endSession");
                if (index2 >= 0) {
                    account.permissions.splice(index2, 1);
                    await queryRunner.manager.save(account);
                }
            }
        }
    }
}
