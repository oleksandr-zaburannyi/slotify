import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class RenameTransactionCubeColumns1618827493000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "rounds");
        await queryRunner.addColumns(queryRunner.connection.options.entityPrefix + "transaction_cube", [
            new TableColumn({name: "numberOfBets", type: "integer", isNullable: true}),
            new TableColumn({name: "numberOfWins", type: "integer", isNullable: true}),
        ]);
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "withdrawals", "bets");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "deposits", "wins");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", new TableColumn({name: "rounds", type: "integer", isNullable: true}));
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "numberOfBets");
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "numberOfWins");

        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "bets", "withdrawals");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "wins", "deposits");
    }
}
