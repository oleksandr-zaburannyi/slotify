import {MigrationInterface, QueryRunner} from "typeorm";

export class AddKeyToProviderTransactionId1627988989001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "${queryRunner.connection.options.entityPrefix}transaction_provider_providerTransactionId" ON ${queryRunner.connection.options.entityPrefix}transaction ("provider", "providerTransactionId");`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "${queryRunner.connection.options.entityPrefix}transaction_provider_providerTransactionId"`);
    }
}
