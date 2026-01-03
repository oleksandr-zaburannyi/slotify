import {BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer} from "typeorm";
import {Round} from "./Round";
import {getConnection} from "@slotify/shared/lib/dbOptions";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

@Entity()
@Index("roundId", ["roundId"], {unique: false})
export class Wager extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @PrimaryColumn({type: "uuid"}) roundId!: string;
    @Column({nullable: true}) step?: number;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz", select: false}) updatedAt!: Date;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) bet?: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) win?: number;
    @Column() action!: string;
    @Column({type: "jsonb", nullable: true}) data: any;
    @Column({type: "jsonb", nullable: true}) next?: string[];
    @Column({type: "jsonb", nullable: true}) state?: any;
    @Column({type: "jsonb", nullable: true}) params?: any;
    @Column({type: "jsonb", nullable: true}) promo?: any;
    @Column({}) auto!: boolean;

    static async getTotalWin(roundId: string): Promise<number> {
        const [{sum}] = await getConnection("primary").query(
            `
            select sum("win")
            from "rgs_wager"
            where "roundId" = $1
        `,
            [roundId],
        );
        return parseFloat(sum);
    }

    static async getByRoundId(roundId: string): Promise<Wager[]> {
        return await Wager.find({where: {roundId}, order: {id: "ASC"}});
    }

    static async getLatestState(playerId: string, game: string): Promise<any> {
        const round = await Round.findOne({where: {playerId, game, active: true}, order: {createdAt: "DESC"}});
        if (!round) return null;

        return this.getStateFromRound(round.roundId);
    }

    static async getPreviousState(round: Round): Promise<any> {
        const previousRound = await Round.getPrevious(round);
        if (!previousRound) return null;
        return await this.getStateFromRound(previousRound.roundId);
    }

    static async getStateFromRound(roundId: string): Promise<any> {
        const lastWager: Pick<Wager, "state"> | null = await Wager.findOne({select: ["id", "state"], where: {roundId}, order: {id: "DESC"}});
        return lastWager && lastWager.state;
    }

    static hasNextAction(wager: Pick<Wager, "next">) {
        return !!wager.next && wager.next.length > 0;
    }

    static async getLastWagerDate(roundId: string) {
        const lastWager = await Wager.findOne({select: ["createdAt"], where: {roundId}, order: {createdAt: "DESC"}});
        return lastWager?.createdAt;
    }
}
