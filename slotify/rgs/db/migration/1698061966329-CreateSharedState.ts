import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateSharedState1698061966329 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "shared_state",
                columns: [
                    {name: "game", type: "varchar", isPrimary: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "data", type: "jsonb", isNullable: true},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "shared_state", true);
    }
}
