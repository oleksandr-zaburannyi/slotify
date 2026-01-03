import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";
export class DeleteDemoWalletPlayer1695636698000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "demo_wallet_player", true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "demo_wallet_player",
                columns: [
                    {name: "nativeId", type: "varchar", isPrimary: true},
                    {name: "balance", type: "numeric"},
                ],
            }),
            true,
        );
    }
}
