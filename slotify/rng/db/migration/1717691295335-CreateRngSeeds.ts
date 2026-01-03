import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateRngSeeds1717691295335 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = queryRunner.connection.options.entityPrefix + "rng_seeds";

        await queryRunner.createTable(
            new Table({
                name: tableName,
                columns: [
                    {name: "seedsId", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "playerId", type: "uuid"},
                    {name: "clientSeed", type: "varchar", length: "64"},
                    {name: "serverSeed", type: "varchar", length: "64"},
                    {name: "serverSeedHash", type: "varchar", length: "64"},
                    {name: "status", type: "varchar"},
                    {name: "nextServerSeed", type: "varchar", length: "64"},
                    {name: "nextServerSeedHash", type: "varchar", length: "64"},
                ],
                indices: [{name: tableName + "_player_sequence_access", columnNames: ["playerId", "status"]}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "rng_seeds", true);
    }
}
