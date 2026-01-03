import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddGroupToWallet1702989627000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "wallet", new TableColumn({name: "group", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "wallet", "group");
    }
}
