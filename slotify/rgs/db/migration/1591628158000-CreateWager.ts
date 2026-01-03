import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateWager1591628158000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "wager",
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true},
                    {name: "roundId", type: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "bet", type: "numeric", isNullable: true},
                    {name: "win", type: "numeric", isNullable: true},
                    {name: "sideBets", type: "jsonb", isNullable: true},
                    {name: "sideWins", type: "jsonb", isNullable: true},
                    {name: "action", type: "varchar"},
                    {name: "variant", type: "varchar", isNullable: true},
                    {name: "data", type: "jsonb", isNullable: true},
                    {name: "next", type: "jsonb", isNullable: true},
                    {name: "state", type: "jsonb", isNullable: true},
                    {name: "params", type: "jsonb", isNullable: true},
                    {name: "auto", type: "boolean"},
                ],
                indices: [{name: queryRunner.connection.options.entityPrefix + "wager_roundId", columnNames: ["roundId"], isUnique: false}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "wager", true);
    }
}
