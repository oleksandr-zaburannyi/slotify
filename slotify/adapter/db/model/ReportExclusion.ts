import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";

type ExclusionColumn = "inspection" | "gameWin";

@Entity()
export class ReportExclusion extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @CreateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "timestamptz", nullable: true}) startsAt?: Date | null;
    @Column({type: "timestamptz", nullable: true}) endsAt?: Date | null;
    @Column({type: "uuid", nullable: true}) playerId?: string;
    @Column({nullable: true}) nativeId?: string;
    @Column({nullable: true}) wallet?: string;
    @Column({nullable: true}) operator?: string;
    @Column({nullable: true}) brand?: string;
    @Column({nullable: true}) currency?: string;
    @Column({type: "boolean", default: true}) inspection!: boolean;
    @Column({type: "boolean", default: true}) gameWin!: boolean;
    @Column({nullable: true}) comment?: string;
    @Column({nullable: true}) reason?: string;

    static readonly EXCLUSION_CHECK_SQL = (playerIdField: string, operatorField: string, brandField: string, dateField: string, column: ExclusionColumn) => `
        SELECT COUNT(*) > 0 as excluded, string_agg(reason, ',') as reason
        FROM adapter_report_exclusion reportexclusion
        WHERE (reportexclusion."playerId" IS NULL OR reportexclusion."playerId" = ${playerIdField})
          AND (reportexclusion."nativeId" IS NULL OR player."nativeId" LIKE REPLACE(reportexclusion."nativeId", '*', '%'))
          AND (reportexclusion.wallet IS NULL OR reportexclusion.wallet = player.wallet)
          AND (reportexclusion.currency IS NULL OR reportexclusion.currency = player.currency)
          AND (reportexclusion.operator IS NULL OR reportexclusion.operator = ${operatorField})
          AND (reportexclusion.brand IS NULL OR reportexclusion.brand = ${brandField})
          AND (reportexclusion."startsAt" IS NULL OR ${dateField} >= reportexclusion."startsAt")
          AND (reportexclusion."endsAt" IS NULL OR ${dateField} <= reportexclusion."endsAt")
          AND reportexclusion."${column}" = TRUE
        LIMIT 1
    `;
    static readonly PLAYER_EXCLUSION_CHECK_SQL = `
        SELECT excluded, reason
        FROM adapter_player player
        LEFT JOIN LATERAL (${ReportExclusion.EXCLUSION_CHECK_SQL("player.id", "player.operator", "player.brand", "$2", "inspection")}) ON TRUE
        WHERE player.id = $1
        LIMIT 1
    `;

    static readonly TRANSACTION_EXCLUSION_CHECK_SQL = ReportExclusion.EXCLUSION_CHECK_SQL('transaction."playerId"', "transaction.operator", "transaction.brand", "transaction.date", "gameWin");

    static async isPlayerExcluded(playerId: string, date?: Date): Promise<{excluded: boolean; reason?: string}> {
        const params = date ? [playerId, date] : [playerId, new Date()];
        const [result] = await ReportExclusion.query(ReportExclusion.PLAYER_EXCLUSION_CHECK_SQL, params);
        return result;
    }
}
