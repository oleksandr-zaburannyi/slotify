import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";
export class AddRgsGameToGame1703089542000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "game", new TableColumn({name: "rgsGame", type: "varchar", isNullable: true}));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "game", "rgsGame");
    }
}
