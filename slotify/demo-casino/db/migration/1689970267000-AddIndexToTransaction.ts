import {MigrationInterface} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";
export class AddIndexToTransaction1689970267000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index if not exists "${queryRunner.connection.options.entityPrefix}transaction_roundId_roundFinished" on ${queryRunner.connection.options.entityPrefix}transaction ("roundId", "roundFinished")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "${queryRunner.connection.options.entityPrefix}transaction_roundId_roundFinished"`);
    }
}
