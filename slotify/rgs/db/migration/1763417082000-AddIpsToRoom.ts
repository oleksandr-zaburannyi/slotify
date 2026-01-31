import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddIpsToRoom1763417082000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "room", [new TableColumn({name: "ips", type: "json", isNullable: true})]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "room", "ips");
    }
}
