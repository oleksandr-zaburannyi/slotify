import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class CreateTheme1733226841456 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const name = queryRunner.connection.options.entityPrefix + "theme";
        await queryRunner.createTable(
            new Table({
                name,
                columns: [
                    {name: "themeId", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "name", type: "varchar", isUnique: true},
                    {name: "campaignType", type: "varchar"},
                    {name: "translations", type: "jsonb"},
                    {name: "icons", type: "jsonb"},
                ],
                indices: [{name: name + "_name", isUnique: true, columnNames: ["name"]}],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "theme", true);
    }
}
