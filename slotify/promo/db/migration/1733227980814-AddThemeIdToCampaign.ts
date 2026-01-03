import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddThemeIdToCampaign1733227980814 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "campaign", new TableColumn({name: "themeId", type: "uuid", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "campaign", "themeId");
    }
}
