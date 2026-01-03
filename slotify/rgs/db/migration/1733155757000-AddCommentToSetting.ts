import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddCommentToSetting1733155757000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn("rgs_settings", new TableColumn({name: "comment", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn("rgs_settings", "comment");
    }
}
