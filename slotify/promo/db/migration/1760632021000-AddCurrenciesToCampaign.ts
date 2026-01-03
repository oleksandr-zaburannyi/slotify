import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddCurrenciesToCampaign1760632021000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "campaign", new TableColumn({name: "currencies", type: "jsonb", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "campaign", "currencies");
    }
}
