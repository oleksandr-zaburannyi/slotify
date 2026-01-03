import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddReportExclusion1754650787966 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "adapter_report_exclusion",
                columns: [
                    {name: "id", type: "integer", isGenerated: true, isPrimary: true},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "startsAt", type: "timestamptz", isNullable: true},
                    {name: "endsAt", type: "timestamptz", isNullable: true},
                    {name: "playerId", type: "uuid", isNullable: true},
                    {name: "nativeId", type: "varchar", isNullable: true},
                    {name: "wallet", type: "varchar", isNullable: true},
                    {name: "operator", type: "varchar", isNullable: true},
                    {name: "brand", type: "varchar", isNullable: true},
                    {name: "currency", type: "varchar", isNullable: true},
                    {name: "comment", type: "varchar", isNullable: true},
                ],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("adapter_report_exclusion");
    }
}
