import {BaseEntity, Column, CreateDateColumn, Entity, In, LessThan, MoreThanOrEqual, Not, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {Wager} from "./Wager";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {getConnection} from "@slotify/shared/lib/dbOptions";

@Entity()
export class Round extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @PrimaryColumn({type: "uuid"}) roundId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "timestamptz"}) failedAt!: Date;
    @PrimaryColumn({type: "uuid"}) playerId!: string;
    @Column() status!: "started" | "finished" | "unpaid" | "failed" | "cancelled";
    @Column() provider?: string;
    @Column() game!: string;
    @Column() active?: boolean;
    @Column() prevRoundId?: string;
    @Column({nullable: true}) variant?: string;
    @Column({nullable: true}) failReason?: string;

    public wagers!: Wager[];

    static async getWithWagers(roundId: string) {
        const round = await Round.findOne({where: {roundId: roundId}});
        if (round) {
            round.wagers = await Wager.find({where: {roundId: roundId}, order: {createdAt: "ASC"}});
        }
        return round;
    }

    static async getStartedFromUser(status: Round["status"][], playerId: string, provider: string, game: string, expiryThreshold?: Date): Promise<Round[]> {
        //"force-index-scan" forces using rgs_round_playerId_game_status_createdAt index (instead of "rgs_round_status_createAt_where")
        return await Round.find({
            where: {
                playerId,
                provider,
                game,
                status: In([...status, "force-index-scan"]),
                updatedAt: expiryThreshold ? MoreThanOrEqual(expiryThreshold) : undefined,
            },
        });
    }

    static async getPrevious({playerId, game, id, prevRoundId}: Round): Promise<Round | null> {
        if (prevRoundId) {
            return await Round.findOneBy({roundId: prevRoundId});
        }
        return await Round.findOne({where: {playerId, game, id: LessThan(id), status: Not(In(["cancelled", "failed"]))}, order: {id: "DESC"}});
    }

    static async getByStatus(statuses: Round["status"][]): Promise<Round[]> {
        return await getConnection("replica").manager.findBy(Round, {status: In(statuses)});
    }

    static async mapRoundToPlayer(round: Round) {
        const previousState = await Wager.getPreviousState(round);
        return {
            roundId: round.roundId,
            previousState: previousState ? removeUnderscoredKeys(previousState) : undefined,
            wagers: round.wagers.map(({createdAt, action, bet, win, data, next, params, state}) => {
                return {createdAt, action, bet, win, data, next, params, state: removeUnderscoredKeys(state || {})};
            }),
        };
    }

    static async fail(roundId: string, failReason: string) {
        await Round.update({roundId}, {status: "failed", failReason, failedAt: new Date()});
    }
}
