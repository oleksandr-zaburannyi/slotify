import {MigrationInterface, QueryRunner} from "typeorm";

export class AddPrevRoundIdUniqueIndex1732192642000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        const date = new Date().toISOString().split("T")[0];
        await queryRunner.query(`create unique index concurrently if not exists "rgs_round_prevRoundId" on rgs_round ("prevRoundId") where "prevRoundId" IS NOT NULL and "createdAt" > '${date}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_round_prevRoundId"`);
    }
}
