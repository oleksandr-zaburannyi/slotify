import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class RenameMonitoringToRoundVerificationCache1695647879000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameTable("adapter_monitoring", "adapter_round_verification_cache");
        await queryRunner.clearTable("adapter_round_verification_cache");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameTable("adapter_round_verification_cache", "adapter_monitoring");
    }
}
