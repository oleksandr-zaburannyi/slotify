import {BaseEntity, Column, CreateDateColumn, Entity, In, IsNull, LessThan, MoreThanOrEqual, Not, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {Wager} from "./Wager";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {getConnection} from "@slotify/shared/lib/dbOptions";

@Entity()
export class Round extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @PrimaryColumn({type: "uuid"}) roundId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "timestamptz", nullable: true}) failedAt?: Date;
    @Column({type: "timestamptz", nullable: true}) completedAt?: Date;
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

    static async getStartedFromUser(playerId: string, provider: string, game: string): Promise<Round[]> {
        return await Round.findBy({
            playerId,
            provider,
            game,
            status: "started",
        });
    }

    static async getFailedFromUser(playerId: string, provider: string, game: string, expiryThreshold: Date): Promise<Round[]> {
        return await Round.findBy({
            playerId,
            provider,
            game,
            status: "failed",
            failedAt: MoreThanOrEqual(expiryThreshold),
        });
    }

    static async getUnpaidFromUser(playerId: string, provider: string, game: string, expiryThreshold: Date): Promise<Round[]> {
        return await Round.findBy({
            playerId,
            provider,
            game,
            status: "unpaid",
            completedAt: MoreThanOrEqual(expiryThreshold),
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

    static async complete(roundId: string): Promise<Round> {
        await Round.update({roundId, completedAt: IsNull()}, {completedAt: new Date()});
        return Round.findOneByOrFail({roundId});
    }
}
