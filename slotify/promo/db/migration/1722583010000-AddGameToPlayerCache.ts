import {MigrationInterface, TableColumn, TableIndex} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddGameToPlayerCache1722583010000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM ${queryRunner.connection.options.entityPrefix}player_cache`);
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "player_cache", new TableColumn({name: "game", type: "varchar"}));
        await queryRunner.createIndex(queryRunner.connection.options.entityPrefix + "player_cache", new TableIndex({name: "promo_player_cache_playerId_game", columnNames: ["playerId", "game"], isUnique: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "player_cache", "game");
        await queryRunner.dropIndex(queryRunner.connection.options.entityPrefix + "player_cache", "promo_player_cache_playerId_game");
    }
}
