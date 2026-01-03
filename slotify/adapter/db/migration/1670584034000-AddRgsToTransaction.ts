import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddRgsToTransaction1670584034000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "provider", "rgs");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "providerTransactionId", "rgsTransactionId");
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "provider", type: "varchar", isNullable: true}));
        await queryRunner.query(`ALTER INDEX "${queryRunner.connection.options.entityPrefix + "transaction_provider_providerTransactionId"}" RENAME TO "${queryRunner.connection.options.entityPrefix + "transaction_rgs_rgsTransactionId"}"`);
        await queryRunner.renameTable(queryRunner.connection.options.entityPrefix + "provider", queryRunner.connection.options.entityPrefix + "rgs");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "rgs", "provider");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction", "rgsTransactionId", "providerTransactionId");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "provider");
        await queryRunner.query(`ALTER INDEX "${queryRunner.connection.options.entityPrefix + "transaction_rgs_rgsTransactionId"}" RENAME TO "${queryRunner.connection.options.entityPrefix + "transaction_provider_providerTransactionId"}"`);
        await queryRunner.renameTable(queryRunner.connection.options.entityPrefix + "provider", queryRunner.connection.options.entityPrefix + "rgs");
    }
}
