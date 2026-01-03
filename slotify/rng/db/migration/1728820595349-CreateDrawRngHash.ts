import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateDrawRngHash1728820595349 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = queryRunner.connection.options.entityPrefix + "draw_rng_hash";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment"},
                    {name: "roomId", type: "uuid"},
                    {name: "hash", type: "varchar", length: "64"},
                    {name: "index", type: "int"},
                    {name: "cursor", type: "int", default: 0},
                    {name: "drawId", type: "uuid", isNullable: true},
                ],
                indices: [
                    {name: tableName + "_room_hashes_sequence_access", columnNames: ["roomId", "index"], isUnique: true},
                    {name: tableName + "_drawId", columnNames: ["drawId"], isUnique: true},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "draw_rng_hash", true);
    }
}
