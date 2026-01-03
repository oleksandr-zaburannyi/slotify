import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddExcluded1720624337000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn("adapter_player", "test", "excluded");
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "excluded", type: "boolean", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn("adapter_player", "excluded", "test");
        await queryRunner.dropColumn("adapter_wallet", "excluded");
    }
}
