import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";

export class AddRgsConfigToGame1728900458000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "game", new TableColumn({name: "rgsConfig", type: "json", isNullable: true}));
        await queryRunner.query(`UPDATE ${queryRunner.connection.options.entityPrefix + "game"} SET "rgsConfig" = $1`, [JSON.stringify({})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "game", "rgsConfig");
    }
}
