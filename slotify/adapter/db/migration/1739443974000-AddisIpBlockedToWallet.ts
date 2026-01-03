import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class AddisIpBlockedToWallet1739443974000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "ipBlocked", type: "boolean", default: true}));
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "geoIpBlocked", type: "boolean", default: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn("adapter_wallet", "ipBlocked");
        await queryRunner.dropColumn("adapter_wallet", "geoIpBlocked");
    }
}
