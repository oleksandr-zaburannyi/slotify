import {MigrationInterface, QueryRunner} from "typeorm";

export class AddIndexOnDrawId1725281911000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "rgs_draw_drawId" on rgs_draw ("drawId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "rgs_draw_drawId"`);
    }
}
