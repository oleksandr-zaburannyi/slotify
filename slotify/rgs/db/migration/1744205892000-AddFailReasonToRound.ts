import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddFailReasonToRound1744205892000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round", new TableColumn({name: "failedAt", type: "timestamptz", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round_archive", new TableColumn({name: "failedAt", type: "timestamptz", isNullable: true}));

        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round", new TableColumn({name: "failReason", type: "varchar", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "round_archive", new TableColumn({name: "failReason", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round", "failedAt");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round_archive", "failedAt");

        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round", "failReason");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "round_archive", "failReason");
    }
}
