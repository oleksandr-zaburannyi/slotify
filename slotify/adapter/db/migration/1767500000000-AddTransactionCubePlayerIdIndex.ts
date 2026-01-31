import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddTransactionCubePlayerIdIndex1767500000000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "adapter_transaction_cube_playerId_date" ON adapter_transaction_cube ("playerId", "date")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "adapter_transaction_cube_playerId_date"`);
    }
}
