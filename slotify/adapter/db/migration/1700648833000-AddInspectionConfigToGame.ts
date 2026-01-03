import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";

export class AddInspectionConfigToGame1700648833000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "game", new TableColumn({name: "inspectionConfig", type: "json", isNullable: true}));
        await queryRunner.query(`UPDATE ${queryRunner.connection.options.entityPrefix + "game"} SET "inspectionConfig" = $1`, [JSON.stringify({})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "game", "inspectionConfig");
    }
}
