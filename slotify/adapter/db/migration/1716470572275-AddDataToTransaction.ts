import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddDataToTransaction1716470572275 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "data", type: "jsonb", isNullable: true}));
        await queryRunner.query(
            `CREATE INDEX CONCURRENTLY "${queryRunner.connection.options.entityPrefix + "transaction_roundIdBigInt"}" ON ${queryRunner.connection.options.entityPrefix + "transaction"}((data->>'roundIdBigInt')) WHERE data IS NOT NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "${queryRunner.connection.options.entityPrefix + "transaction_roundIdBigInt"}"`);
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "data");
    }
}
