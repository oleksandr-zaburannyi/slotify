import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateRoundRngState1717694306461 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = queryRunner.connection.options.entityPrefix + "round_rng_state";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "playerId", type: "uuid"},
                    {name: "game", type: "varchar"},
                    {name: "roundId", type: "uuid"},
                    {name: "seedsId", type: "uuid"},
                    {name: "nonce", type: "integer"},
                    {name: "cursor", type: "integer"},
                    {name: "status", type: "varchar"},
                ],
                indices: [
                    {name: tableName + "_player_sequence_access", columnNames: ["playerId", "status"]},
                    {name: tableName + "_seeds_sequence_access", columnNames: ["seedsId", "nonce"]},
                    {name: tableName + "_roundId", columnNames: ["roundId"]},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "round_rng_state", true);
    }
}
