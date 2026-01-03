import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddIndexToServerSeed1718027361000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index if not exists "rng_rng_seeds_serverSeed" on rng_rng_seeds ("serverSeed")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "rng_rng_seeds_serverSeed"`);
    }
}
