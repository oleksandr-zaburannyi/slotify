import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddBlockedToPlayer1651143055000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "player", [new TableColumn({name: "blocked", type: "boolean", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "player", "blocked");
    }
}
