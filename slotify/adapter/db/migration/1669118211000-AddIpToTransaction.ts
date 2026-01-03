import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIpToTransaction1669118211000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction", new TableColumn({name: "ip", isNullable: true, type: "varchar"}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction", "ip");
    }
}
