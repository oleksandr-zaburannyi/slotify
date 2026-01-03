import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddOneTimeKeyBlockedToWallet1758634837598 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "wallet", new TableColumn({name: "oneTimeKeyBlocked", type: "boolean", default: false}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wallet", "oneTimeKeyBlocked");
    }
}
