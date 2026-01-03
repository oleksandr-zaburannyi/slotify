import {MigrationInterface, QueryRunner} from "typeorm";

export class RenameTransactionCubeColumnsTwo1618842793000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "bets", "totalBet");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "wins", "totalWin");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "numberOfBets", "bets");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "numberOfWins", "wins");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "totalBet", "bets");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "totalWin", "wins");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "bets", "numberOfBets");
        await queryRunner.renameColumn(queryRunner.connection.options.entityPrefix + "transaction_cube", "wins", "numberOfWins");
    }
}
