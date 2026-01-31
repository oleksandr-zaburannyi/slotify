import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddCommandDrawIdPlayerIdIndex1769598774968 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "rgs_command_drawId_playerId_createdAt" ON rgs_command ("drawId", "playerId", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "rgs_command_drawId_playerId_createdAt"`);
    }
}
