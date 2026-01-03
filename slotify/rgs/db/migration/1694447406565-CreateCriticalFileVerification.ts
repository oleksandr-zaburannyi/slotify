import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateCriticalFileVerification1694447406565 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = queryRunner.connection.options.entityPrefix + "critical_file_verification";

        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "critical_file_verification",
                columns: [
                    {name: "id", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "fileId", type: "integer"},
                    {name: "loggedChecksum", type: "varchar", isNullable: true},
                ],
            }),
            true,
        );

        const fileIdIndex = queryRunner.connection.options.entityPrefix + "critical_file_verification_file_id";
        await queryRunner.query(`CREATE INDEX "${fileIdIndex}" ON "${tableName}" ("fileId" ASC)`);

        const timestampIndex = queryRunner.connection.options.entityPrefix + "critical_file_verification_timestamp";
        await queryRunner.query(`CREATE INDEX "${timestampIndex}" ON "${tableName}" ("createdAt" DESC)`);

        const fileIdTimestampIndex = queryRunner.connection.options.entityPrefix + "critical_file_verification_file_id_timestamp";
        await queryRunner.query(`CREATE UNIQUE INDEX "${fileIdTimestampIndex}" ON "${tableName}" ("fileId" ASC, "createdAt" DESC)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "critical_file_verification", true);
    }
}
