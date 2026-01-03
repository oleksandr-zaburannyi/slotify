import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class RenameWagerIdtoWagerStepInGameFeed1728587217000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "game_feed", "wagerId", "wagerStep");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "game_feed", "wagerStep", "wagerId");
    }
}
