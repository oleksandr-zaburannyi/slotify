import {MigrationInterface, QueryRunner} from "typeorm";

export class ImplementGenerateHashChainFunction1729601319341 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE OR REPLACE PROCEDURE generate_hash_chain(roomId UUID, chain_length INT)
AS
$$
DECLARE
    index INT;
    hash  TEXT;
BEGIN
    index := chain_length;
    hash := encode(gen_random_bytes(32), 'hex');
    WHILE index > 0
        LOOP
            index := index - 1;
            hash := encode(digest(hash, 'sha256'), 'hex');
            INSERT INTO rng_draw_rng_hash ("roomId", hash, index) VALUES (roomId, hash, index);

            IF index % 5000 = 0 THEN
                PERFORM pg_sleep(0.1);
            END IF;

        END LOOP;
END
$$
    LANGUAGE plpgsql`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP PROCEDURE IF EXISTS generate_hash_chain");
    }
}
