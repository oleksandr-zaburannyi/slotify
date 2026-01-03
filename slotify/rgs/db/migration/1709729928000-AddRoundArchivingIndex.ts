import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddRoundArchivingIndex1709729928000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "rgs_round_active_status_createdAt" ON rgs_round (active, status, "createdAt") WHERE active IS NOT TRUE`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX IF EXISTS "rgs_round_active_status_createdAt"`);
    }
}
