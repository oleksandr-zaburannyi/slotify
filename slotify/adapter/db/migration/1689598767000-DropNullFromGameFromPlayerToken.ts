import {MigrationInterface, QueryRunner} from "typeorm";
export class DropNullFromGameFromPlayerToken1689598767000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${queryRunner.connection.options.entityPrefix + "player_token"} ALTER COLUMN "game" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${queryRunner.connection.options.entityPrefix + "player_token"} ALTER COLUMN "game" SET NOT NULL`);
    }
}
