import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";

export class AddSessionIdToTransaction1696255713000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "sessionId", type: "uuid", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "sessionId");
    }
}
