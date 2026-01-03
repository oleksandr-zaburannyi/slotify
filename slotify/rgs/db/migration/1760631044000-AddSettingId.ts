import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddSettingId1760631044000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "settings", new TableColumn({name: "settingId", type: "varchar", isNullable: false, default: "uuid_generate_v4()"}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "settings", "settingId");
    }
}
