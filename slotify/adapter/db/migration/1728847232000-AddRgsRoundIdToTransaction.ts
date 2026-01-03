import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddRgsRoundIdToTransaction1728847232000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction", [new TableColumn({name: "rgsRoundId", type: "varchar", isNullable: true})]);
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction_archive", [new TableColumn({name: "rgsRoundId", type: "varchar", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "rgsRoundId");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_archive", "rgsRoundId");
    }
}
