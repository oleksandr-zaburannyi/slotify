import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";

export class AddFieldsToGame1698060304000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "game", [new TableColumn({name: "type", type: "varchar", isNullable: true}), new TableColumn({name: "title", type: "varchar", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumns(queryRunner.connection.options.entityPrefix + "game", ["title", "type"]);
    }
}
