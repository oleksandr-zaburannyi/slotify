import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class AddProvablyFairRoomColumn1728821838860 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "room", new TableColumn({name: "provablyFair", type: "jsonb", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "room", "provablyFair");
    }
}
