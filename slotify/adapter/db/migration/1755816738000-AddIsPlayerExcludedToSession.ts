import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIsPlayerExcludedToSession1755816738000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "adapter_session",
            new TableColumn({
                name: "isPlayerExcluded",
                type: "boolean",
                default: false,
                isNullable: false,
            }),
        );
        await queryRunner.addColumn("adapter_session_archive", new TableColumn({name: "isPlayerExcluded", type: "boolean", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("adapter_session_archive", "isPlayerExcluded");
        await queryRunner.dropColumn("adapter_session", "isPlayerExcluded");
    }
}
