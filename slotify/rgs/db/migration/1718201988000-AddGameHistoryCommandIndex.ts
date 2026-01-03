import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddGameHistoryCommandIndex1718201988000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_command_playerId_withdrawalStatus_createdAt" on rgs_command ("playerId", "withdrawalStatus", "createdAt") where bet is not null`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rgs_command_playerId_withdrawalStatus_createdAt"`);
    }
}
