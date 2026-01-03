import {MigrationInterface, Table} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

export class CreateTransaction1591610638000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.createTable(
            new Table({
                name: queryRunner.connection.options.entityPrefix + "transaction",
                columns: [
                    {name: "id", type: "uuid", isPrimary: true, isGenerated: true, generationStrategy: "uuid"},
                    {name: "createdAt", type: "timestamptz", default: "now()"},
                    {name: "updatedAt", type: "timestamptz", default: "now()"},
                    {name: "type", type: "varchar"},
                    {name: "amount", type: "numeric", isNullable: true},
                    {name: "jackpotAmount", type: "numeric", isNullable: true},
                    {name: "roundId", type: "varchar"},
                    {name: "status", type: "varchar"},
                    {name: "game", type: "varchar"},
                    {name: "roundFinished", type: "boolean", isNullable: true},
                    {name: "provider", type: "varchar", isNullable: true},
                    {name: "playerId", type: "uuid"},
                    {name: "category", type: "varchar", isNullable: true},
                    {name: "name", type: "varchar", isNullable: true},
                    {name: "promotionType", type: "varchar", isNullable: true},
                    {name: "promotionId", type: "varchar", isNullable: true},
                    {name: "auto", type: "boolean"},
                    {name: "balanceAfter", type: "numeric", isNullable: true},
                    {name: "finishedAt", type: "timestamptz", isNullable: true},
                ],
                indices: [
                    {name: queryRunner.connection.options.entityPrefix + "transaction_createdAt", columnNames: ["createdAt"], isUnique: false},
                    {name: queryRunner.connection.options.entityPrefix + "transaction_finishedAt", columnNames: ["finishedAt"], isUnique: false},
                    {name: queryRunner.connection.options.entityPrefix + "transaction_playerId", columnNames: ["playerId"], isUnique: false},
                    {name: queryRunner.connection.options.entityPrefix + "transaction_roundId", columnNames: ["roundId"], isUnique: false},
                    {name: queryRunner.connection.options.entityPrefix + "transaction_status_type", columnNames: ["status", "type"], isUnique: false},
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable(queryRunner.connection.options.entityPrefix + "transaction", true);
    }
}
