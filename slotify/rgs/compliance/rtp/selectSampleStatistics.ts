import {SampleStatistics} from "./statistics";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {SelectQueryBuilder} from "typeorm";
import {Room} from "../../db/model/Room";

const precisionMapper = (value: number) => Number(value.toFixed(8));

export async function selectSampleStatistics(game: string, variant: string | undefined, start: Date, end: Date): Promise<SampleStatistics> {
    const isMultiplayer = await hasMultiplayerRoom(game);
    if (isMultiplayer) {
        return selectMultiplayerSampleStatistics(game, variant, start, end);
    }
    return selectSinglePlayerSampleStatistics(game, variant, start, end);
}

async function hasMultiplayerRoom(game: string): Promise<boolean> {
    const rooms = await Room.getRooms();
    return rooms.some(room => room.game === game);
}

async function selectSinglePlayerSampleStatistics(game: string, variant: string | undefined, start: Date, end: Date): Promise<SampleStatistics> {
    const result = (await getConnection("replica")
        .createQueryBuilder()
        .select("COUNT(normalised_round)", "count")
        .addSelect("AVG(normalised_round.normalised_win)", "mean")
        .addSelect("VAR_SAMP(normalised_round.normalised_win)", "variance")
        .from(normalisedRoundsFromTimePeriod(game, variant, start, end), "normalised_round")
        .getRawOne()) as any;

    return {
        count: parseInt(result.count),
        mean: result.mean ? precisionMapper(parseFloat(result.mean)) : undefined,
        variance: result.variance ? precisionMapper(parseFloat(result.variance)) : undefined,
    };
}

function normalisedRoundsFromTimePeriod(game: string, variant: string | undefined, start: Date, end: Date): (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any> {
    return normalisedRoundSubQuery =>
        normalisedRoundSubQuery
            .select("SUM(wager.win) / SUM(wager.bet)", "normalised_win")
            .from("rgs_wager", "wager")
            .innerJoin(finishedRoundsFromTimePeriod(game, variant, start, end), "round", 'wager."roundId" = round."roundId"')
            .groupBy('wager."roundId"');
}

function finishedRoundsFromTimePeriod(game: string, variant: string | undefined, start: Date, end: Date): (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any> {
    return roundSubQueryBuilder => {
        roundSubQueryBuilder
            .select('"roundId"')
            .from("rgs_round", "round")
            .andWhere("game = :game", {game})
            .andWhere('"updatedAt" > :start', {start})
            .andWhere('"updatedAt" <= :end', {end})
            .andWhere("status = :status", {status: "finished"});

        if (variant) {
            roundSubQueryBuilder.andWhere("variant = :variant", {variant});
        } else {
            roundSubQueryBuilder.andWhere("variant IS NULL");
        }

        return roundSubQueryBuilder;
    };
}

async function selectMultiplayerSampleStatistics(game: string, variant: string | undefined, start: Date, end: Date): Promise<SampleStatistics> {
    // Use raw SQL with subqueries to avoid Cartesian product when aggregating commands and wins
    // Normalize wins per round (not draw) - join Commands and DrawWins on roundId
    // Use DrawWin timestamp for filtering (guaranteed one per round)
    const variantCondition = variant ? "rgs_room.variant = $4" : "rgs_room.variant IS NULL";
    const params = variant ? [game, start, end, variant] : [game, start, end];

    const result = await getConnection("replica").query(
        `
            WITH round_draw_wins AS (SELECT DISTINCT rgs_draw_win."roundId"
                                     FROM rgs_draw_win
                                              INNER JOIN rgs_command ON rgs_command."roundId" = rgs_draw_win."roundId"
                                              INNER JOIN rgs_room ON rgs_room."roomId" = rgs_command."roomId"
                                     WHERE rgs_room.game = $1
                                       AND ${variantCondition}
                                       AND rgs_draw_win."createdAt" > $2
                                       AND rgs_draw_win."createdAt" <= $3
                                       AND rgs_draw_win.status = 'finished'),
                 round_stats AS (SELECT rdw."roundId",
                                        (SELECT COALESCE(SUM(rgs_command.bet), 0)
                                         FROM rgs_command
                                         WHERE rgs_command."roundId" = rdw."roundId"
                                           AND rgs_command.bet IS NOT NULL
                                           AND rgs_command."withdrawalStatus" = 'finished') as total_bet,
                                        (SELECT COALESCE(SUM(rgs_draw_win.amount), 0)
                                         FROM rgs_draw_win
                                         WHERE rgs_draw_win."roundId" = rdw."roundId"
                                           AND rgs_draw_win.status = 'finished')                 as total_win
                                 FROM round_draw_wins rdw),
                 normalised_rounds AS (SELECT total_win / NULLIF(total_bet, 0) as normalised_win
                                       FROM round_stats
                                       WHERE total_bet > 0)
            SELECT COUNT(*)                 as count,
                   AVG(normalised_win)      as mean,
                   VAR_SAMP(normalised_win) as variance
            FROM normalised_rounds
        `,
        params,
    );

    const count = parseInt(result[0].count);

    return {
        count,
        mean: count > 0 && result[0].mean !== null ? precisionMapper(parseFloat(result[0].mean)) : undefined,
        variance: count > 1 && result[0].variance !== null ? precisionMapper(parseFloat(result[0].variance)) : undefined,
    };
}
