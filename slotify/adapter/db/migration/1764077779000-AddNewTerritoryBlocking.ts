import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddNewTerritoryBlocking1764077779000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("adapter_wallet", "ipBlocked");
        await queryRunner.dropColumn("adapter_wallet", "geoIpBlocked");
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "ipBlockedCountries", type: "json", isNullable: true}));
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "ipBlockedRegions", type: "json", isNullable: true}));
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "apiBlockedCountries", type: "json", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "ipBlocked", type: "boolean", default: true}));
        await queryRunner.addColumn("adapter_wallet", new TableColumn({name: "geoIpBlocked", type: "boolean", default: true}));
        await queryRunner.dropColumn("adapter_wallet", "ipBlockedCountries");
        await queryRunner.dropColumn("adapter_wallet", "ipBlockedRegions");
        await queryRunner.dropColumn("adapter_wallet", "apiBlockedCountries");
    }
}
