import {MigrationInterface, QueryRunner} from "typeorm";

export class DropNotNullOnGameInTransactions1661432642000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${queryRunner.connection.options.entityPrefix + "transaction"}
            ALTER COLUMN game DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${queryRunner.connection.options.entityPrefix + "transaction"}
            ALTER COLUMN game SET NOT NULL`);
    }
}
