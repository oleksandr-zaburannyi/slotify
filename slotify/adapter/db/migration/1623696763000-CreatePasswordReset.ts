import {MigrationInterface, QueryRunner, Table, TableColumn} from "typeorm";

export class CreatePasswordReset1623696763000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "password_reset",
                columns: [
                    new TableColumn({name: "id", type: "integer", isGenerated: true, generationStrategy: "increment", isPrimary: true}),
                    new TableColumn({name: "createdAt", type: "timestamptz", default: "now()"}),
                    new TableColumn({name: "email", type: "varchar"}),
                    new TableColumn({name: "key", type: "varchar"}),
                ],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "password_reset");
    }
}
