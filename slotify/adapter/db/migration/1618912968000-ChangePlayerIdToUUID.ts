import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class ChangePlayerIdToUUID1618912968000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.changeColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "playerId", new TableColumn({name: "playerId", type: "uuid", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.changeColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "playerId", new TableColumn({name: "playerId", type: "varchar", isNullable: true}));
    }
}
