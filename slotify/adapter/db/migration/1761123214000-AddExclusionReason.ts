import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddExclusionReason1761123214000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "report_exclusion", new TableColumn({name: "reason", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "report_exclusion", "reason");
    }
}
