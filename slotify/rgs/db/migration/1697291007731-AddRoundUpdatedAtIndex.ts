import {MigrationInterface, QueryRunner} from "typeorm";

export class AddRoundUpdatedAtIndex1697291007731 implements MigrationInterface {
    transaction = false;

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "rgs_round_updatedAt" ON rgs_round("updatedAt")`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "rgs_round_updatedAt"`);
    }
}
