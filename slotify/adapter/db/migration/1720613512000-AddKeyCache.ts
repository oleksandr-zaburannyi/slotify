import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddKeyCache1720613512000 implements MigrationInterface {
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn("adapter_session", new TableColumn({name: "key", type: "varchar", isNullable: true}));
        await queryRunner.addColumn("adapter_session_archive", new TableColumn({name: "key", type: "varchar", isNullable: true}));
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "keyCacheExpiry", type: "numeric", isNullable: true}));
        await queryRunner.query(`create index concurrently if not exists "adapter_session_key_active" on adapter_session (key, active)`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`drop index if exists "adapter_session_key_active"`);
        await queryRunner.dropColumn("adapter_session", "key");
        await queryRunner.dropColumn("adapter_session_archive", "key");
        await queryRunner.dropColumn("adapter_wallet", "keyCacheExpiry");
    }
}
