import {MigrationInterface, QueryRunner, TableColumn, TableIndex} from "typeorm";

export class RemoveTokenFromPlayer1685915588000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex(queryRunner.connection.options.entityPrefix + "player", queryRunner.connection.options.entityPrefix + "player_token_wallet");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "player", "token");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "player", new TableColumn({name: "token", type: "varchar"}));
        await queryRunner.createIndex(queryRunner.connection.options.entityPrefix + "player", new TableIndex({name: queryRunner.connection.options.entityPrefix + "player_token_wallet", columnNames: ["token", "wallet"], isUnique: false}));
    }
}
