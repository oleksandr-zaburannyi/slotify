import {SampleStatistics} from "./statistics";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {SelectQueryBuilder} from "typeorm";

const precisionMapper = (value: number) => Number(value.toFixed(8));

export async function selectSampleStatistics(game: string, variant: string | undefined, start: Date, end: Date): Promise<SampleStatistics> {
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
