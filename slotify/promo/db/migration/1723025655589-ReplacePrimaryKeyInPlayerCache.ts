import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class ReplacePrimaryKeyInPlayerCache1723025655589 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropPrimaryKey(queryRunner.connection.options.entityPrefix + "player_cache");
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "player_cache", new TableColumn({name: "id", type: "uuid", isPrimary: true, isNullable: false, default: "uuid_generate_v4()"}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "player_cache", "id");
        await queryRunner.changeColumn(queryRunner.connection.options.entityPrefix + "player_cache", "playerId", new TableColumn({name: "playerId", type: "varchar", isPrimary: true}));
    }
}
