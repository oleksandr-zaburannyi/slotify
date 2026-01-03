import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreatePlayer1592903038000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "player",
                columns: [
                    {name: "id", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "nativeId", type: "varchar"},
                    {name: "currency", type: "varchar"},
                    {name: "operator", type: "varchar"},
                    {name: "wallet", type: "varchar"},
                    {name: "token", type: "varchar"},
                    {name: "nickname", type: "varchar", isNullable: true},
                    {name: "gender", type: "varchar", isNullable: true},
                    {name: "country", type: "varchar", isNullable: true},
                    {name: "jurisdiction", type: "varchar", isNullable: true},
                    {name: "brand", type: "varchar", isNullable: true},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "player_nativeId_wallet", columnNames: ["nativeId", "wallet"], isUnique: true},
                    {name: queryRunner.connection.options.entityPrefix + "player_token_wallet", columnNames: ["token", "wallet"], isUnique: false},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "player", true);
    }
}
