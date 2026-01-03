import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";

export class AddDataToSession1696324690000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "session", new TableColumn({name: "data", type: "jsonb", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "session", "data");
    }
}
