import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddDataToCommand1744140939773 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn("rgs_command", new TableColumn({name: "data", type: "jsonb", isNullable: true}));
        await queryRunner.addColumn("rgs_command_archive", new TableColumn({name: "data", type: "jsonb", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn("rgs_command", "data");
        await queryRunner.dropColumn("rgs_command_archive", "data");
    }
}
