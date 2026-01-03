import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddRoundIdToCommand1717680041000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM rgs_command`);
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "command", new TableColumn({name: "roundId", type: "uuid"}));
        await queryRunner.query(`create index concurrently if not exists "rgs_command_roundId_withdrawalStatus" on rgs_command ("roundId", "withdrawalStatus")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "command", "roundId");
        await queryRunner.query(`drop index if exists "rgs_command_roundId_withdrawalStatus"`);
    }
}
