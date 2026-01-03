import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateRoomRngSeed1728820613651 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = queryRunner.connection.options.entityPrefix + "room_rng_seed";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "id", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "roomId", type: "uuid"},
                    {name: "chainLength", type: "int"},
                    {name: "activeIndex", type: "int", default: 0},
                    {name: "lastHash", type: "varchar", length: "64", isNullable: true},
                    {name: "seed", type: "varchar", length: "64", isNullable: true},
                ],
                indices: [{name: tableName + "_roomId", columnNames: ["roomId"], isUnique: true}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "draw_rng_hash", true);
    }
}
