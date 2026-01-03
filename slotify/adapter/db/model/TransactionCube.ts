import {BaseEntity, Column, Entity, PrimaryGeneratedColumn, ValueTransformer} from "typeorm";
import {getConnection} from "@slotify/shared/lib/dbOptions";

const toFloat: ValueTransformer = {to: value => (value ? parseFloat(value) : value), from: value => (value ? parseFloat(value) : value)};
const toInt: ValueTransformer = {to: value => (value ? parseInt(value, 10) : value), from: value => (value ? parseInt(value, 10) : value)};

export type TransactionType = "deposit" | "withdraw";

@Entity()
export class TransactionCube extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column({type: "timestamptz", nullable: true}) date?: Date;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) jackpotContribution?: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) jackpotWin?: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) totalBet?: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) totalWin?: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) normalisedTotalBet?: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) normalisedTotalWin?: number;
    @Column({nullable: true, transformer: toInt}) bets?: number;
    @Column({nullable: true, transformer: toInt}) wins?: number;
    @Column({nullable: true, type: "uuid"}) playerId?: string;
    @Column({nullable: true}) game?: string;
    @Column({nullable: true}) variant?: string;
    @Column({nullable: true}) currency?: string;
    @Column({nullable: true}) wallet?: string;
    @Column({nullable: true}) operator?: string;
    @Column({nullable: true}) brand?: string;
    @Column({nullable: true}) rgs?: string;
    @Column({nullable: true}) provider?: string;
    @Column({nullable: true}) category?: string;
    @Column({nullable: true}) name?: string;
    @Column({nullable: true}) channel?: string;
    @Column({nullable: true}) campaignType?: string;
    @Column({nullable: true}) campaignId?: string;
    @Column({nullable: true}) empty!: boolean;

    static async getLast(): Promise<TransactionCube | null> {
        return await getConnection("replica").createQueryBuilder(TransactionCube, "sorted_cube").orderBy("date", "DESC").limit(1).getOne();
    }
}
