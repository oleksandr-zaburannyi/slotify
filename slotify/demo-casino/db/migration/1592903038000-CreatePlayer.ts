import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreatePlayer1592903038000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "player",
                columns: [
                    {name: "nativeId", type: "varchar", isPrimary: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "currency", type: "varchar"},
                    {name: "operator", type: "varchar"},
                    {name: "brand", type: "varchar"},
                    {name: "token", type: "varchar"},
                    {name: "nickname", type: "varchar", isNullable: true},
                    {name: "gender", type: "varchar", isNullable: true},
                    {name: "country", type: "varchar", isNullable: true},
                    {name: "jurisdiction", type: "varchar", isNullable: true},
                    {name: "balance", type: "numeric"},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "player_token", columnNames: ["token"], isUnique: false},
                    {name: queryRunner.connection.options.entityPrefix + "player_updatedAt", columnNames: ["updatedAt"], isUnique: false},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "player", true);
    }
}
