import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateRoom1708880143545 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "room",
                columns: [
                    {name: "roomId", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "deletedAt", type: "timestamptz", isNullable: true},
                    {name: "name", type: "varchar", isNullable: true},
                    {name: "provider", type: "varchar", isNullable: true},
                    {name: "game", type: "varchar", isNullable: true},
                    {name: "config", type: "jsonb", isNullable: true},
                    {name: "enabled", type: "boolean"},
                    {name: "minBet", type: "decimal", isNullable: true},
                    {name: "maxBet", type: "decimal", isNullable: true},
                    {name: "currencies", type: "jsonb", isNullable: true},
                    {name: "wallets", type: "jsonb", isNullable: true},
                    {name: "operators", type: "jsonb", isNullable: true},
                    {name: "brands", type: "jsonb", isNullable: true},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "room", true);
    }
}
