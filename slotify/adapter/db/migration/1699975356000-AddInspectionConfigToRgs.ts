import {MigrationInterface, QueryRunner} from "typeorm";
import {TableColumn} from "typeorm/schema-builder/table/TableColumn";

const inspectionConfig: any = {
    validation: {
        maxWithdraws: 1,
        maxDeposits: 1,
    },
    alerting: {
        maxWin: 10000,
        maxWinRatio: 5000,
    },
    verification: {
        alertedThreshold: 75,
        rejectedThreshold: 100,
        maxPlayerRejectedTransactions: 2,
        maxWalletRejectedTransactions: 3,
        rules: {
            playerRegistration: [
                {operator: "<=", value: 2, points: 15},
                {operator: "<=", value: 24, points: 10},
                {operator: "<=", value: 24 * 14, points: 5},
                {operator: ">", value: 14 * 25, points: -5},
            ],
            transactionOffset: [
                {operator: "<=", value: 100, points: 100},
                {operator: "<=", value: 1000, points: 50},
            ],
            consecutiveWinsWithSameAmount: [
                {operator: ">=", value: 4, points: 100},
                {operator: ">=", value: 3, points: 50},
            ],
            winFrequencyShortTerm: [
                {operator: ">=", value: 0.9, points: 70},
                {operator: ">=", value: 0.8, points: 50},
                {operator: ">=", value: 0.7, points: 30},
                {operator: "<=", value: 0.1, points: -20},
                {operator: "<=", value: 0.2, points: -40},
            ],
            playerRTPLongTerm: [
                {operator: "<=", value: 0.9, points: -70},
                {operator: "<=", value: 0.95, points: -60},
                {operator: "<=", value: 1, points: -50},
            ],
            playerGameWinMediumTerm: [
                {operator: "<=", value: -30000, points: 60},
                {operator: "<=", value: -20000, points: 40},
                {operator: "<=", value: -10000, points: 20},
                {operator: ">=", value: 20000, points: -30},
                {operator: ">=", value: 10000, points: -20},
                {operator: ">=", value: 5000, points: -10},
            ],
            playerShortTermNormalizedRTP: [
                {operator: ">=", value: 1.5, points: 30},
                {operator: ">=", value: 1.2, points: 20},
                {operator: ">=", value: 1, points: 10},
                {operator: "<=", value: 0.6, points: -10},
                {operator: "<=", value: 0.7, points: -20},
                {operator: "<=", value: 0.8, points: -30},
            ],
            winAmount: [
                {operator: ">=", value: 100000, points: 50},
                {operator: ">=", value: 50000, points: 40},
                {operator: ">=", value: 10000, points: 30},
                {operator: ">=", value: 5000, points: 20},
                {operator: "<=", value: 100, points: -20},
            ],
            numberOfLargetNetWins: [
                {operator: ">=", value: 6, points: 30},
                {operator: ">=", value: 5, points: 20},
                {operator: ">=", value: 3, points: 10},
            ],
            maxWinRatio: [
                {operator: ">", value: 1, points: 200},
                {operator: ">", value: 0.75, points: 30},
                {operator: ">", value: 0.5, points: 20},
            ],
            walletGameWinShortTerm: [
                {operator: "<=", value: -100000, points: 60},
                {operator: "<=", value: -50000, points: 50},
                {operator: "<=", value: -25000, points: 40},
                {operator: ">=", value: 20000, points: -30},
                {operator: ">=", value: 10000, points: -20},
                {operator: ">=", value: 5000, points: -10},
            ],
        },
    },
};

export class AddInspectionConfigToRgs1699975356000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "rgs", new TableColumn({name: "inspectionConfig", type: "json", isNullable: true}));
        await queryRunner.query(`UPDATE ${queryRunner.connection.options.entityPrefix + "rgs"} SET "inspectionConfig" = $1`, [JSON.stringify(inspectionConfig)]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "rgs", "inspectionConfig");
    }
}
