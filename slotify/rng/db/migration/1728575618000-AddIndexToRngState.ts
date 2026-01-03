import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIndexToRngState1728575618000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index if not exists "rng_round_rng_state_roundId_playerId_game" on rng_round_rng_state ("roundId", "playerId", game)`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rng_round_rng_state_roundId_playerId_game"`);
    }
}
