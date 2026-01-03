import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddGroupToPlayer1708694226000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "player", new TableColumn({name: "group", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "player", "group");
    }
}
