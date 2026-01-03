import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateGameFeed1698923836768 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const tableName = queryRunner.connection.options.entityPrefix + "game_feed";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "game", type: "varchar"},
                    {name: "roundId", type: "uuid"},
                    {name: "wagerId", type: "integer"},
                    {name: "data", type: "jsonb"},
                ],
                indices: [{name: tableName + "_game_timestamp", columnNames: ["game", "id"], isUnique: true}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "game_feed", true);
    }
}
