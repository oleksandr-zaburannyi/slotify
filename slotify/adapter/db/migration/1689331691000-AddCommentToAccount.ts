import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddCommentToAccount1689331691000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "account", [new TableColumn({name: "comment", type: "varchar", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "account", "comment");
    }
}
