import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateDrawWin1709915743976 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const tableName = queryRunner.connection.options.entityPrefix + "draw_win";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "drawWinId", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "playerId", type: "uuid"},
                    {name: "drawId", type: "uuid"},
                    {name: "roundId", type: "uuid"},
                    {name: "tickId", type: "bigint"},
                    {name: "amount", type: "decimal"},
                    {name: "status", type: "varchar"},
                ],
                indices: [
                    {name: tableName + "_tickId", columnNames: ["tickId"]},
                    {name: tableName + "_drawId_playerId", columnNames: ["drawId", "playerId"]},
                    {name: tableName + "_roundId", columnNames: ["roundId"], isUnique: true},
                    {name: tableName + "_status_unpaid", columnNames: ["status"], where: "status = 'unpaid'"},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "draw_win", true);
    }
}
