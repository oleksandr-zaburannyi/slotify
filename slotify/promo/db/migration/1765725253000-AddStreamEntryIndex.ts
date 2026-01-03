import {MigrationInterface, QueryRunner} from "typeorm";

export class AddStreamEntryIndex1765725253000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "promo_stream_entry_processed_streamId_id" on promo_stream_entry ("processed", "streamId", "id") where processed = false`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "promo_stream_entry_processed_streamId_id"`);
    }
}
