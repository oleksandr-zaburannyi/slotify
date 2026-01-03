import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";

export class AddFieldsToGame1697115648000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "game", [
            new TableColumn({name: "wallets", type: "jsonb", isNullable: true}),
            new TableColumn({name: "operators", type: "jsonb", isNullable: true}),
            new TableColumn({name: "brands", type: "jsonb", isNullable: true}),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumns(queryRunner.connection.options.entityPrefix + "game", ["wallets", "operators", "brands"]);
    }
}
