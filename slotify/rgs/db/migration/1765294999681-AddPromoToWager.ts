import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddPromoToWager1765294999000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "wager", new TableColumn({name: "promo", type: "jsonb", isNullable: true}));
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "wager_archive", new TableColumn({name: "promo", type: "jsonb", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wager", "promo");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wager_archive", "promo");
    }
}
