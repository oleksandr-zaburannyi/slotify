import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddVariantToRoom1759997783000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "room", new TableColumn({name: "variant", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "room", "variant");
    }
}
