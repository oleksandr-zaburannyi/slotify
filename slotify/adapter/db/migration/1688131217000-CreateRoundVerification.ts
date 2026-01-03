import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateRoundVerification1688131217000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "round_verification",
                columns: [
                    {name: "roundId", type: "varchar", isPrimary: true},
                    {name: "action", type: "varchar"},
                    {name: "score", type: "decimal"},
                    {name: "details", type: "jsonb"},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "round_verification", true);
    }
}
