import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class RemoveLatestCommandId1716977064000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn("rgs_tick", "latestCommandId");
        await queryRunner.addColumn("rgs_command", new TableColumn({name: "processed", type: "boolean", isNullable: true}));
        await queryRunner.query(`UPDATE rgs_command SET processed = true`);
        await queryRunner.query(`create index concurrently if not exists "rgs_command_roomId_processed_withdrawalStatus_id" ON rgs_command ("roomId", processed, "withdrawalStatus", id) where processed is null`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn("rgs_tick", new TableColumn({name: "latestCommandId", type: "bigint", isNullable: true}));
        await queryRunner.dropColumn("rgs_command", "processed");
        await queryRunner.query(`drop index if exists "rgs_command_roomId_processed_withdrawalStatus_id"`);
    }
}
