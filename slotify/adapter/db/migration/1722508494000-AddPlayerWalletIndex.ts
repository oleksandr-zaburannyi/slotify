import {MigrationInterface, QueryRunner} from "typeorm";

export class AddPlayerWalletIndex1722508494000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`create index concurrently if not exists "adapter_player_wallet" ON adapter_player ("wallet")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index concurrently if exists "adapter_player_wallet"`);
    }
}
