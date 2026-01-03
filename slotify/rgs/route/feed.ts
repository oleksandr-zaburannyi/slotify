import {Round} from "../db/model/Round";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {GameFeed} from "../db/model/GameFeed";

export default async function feed(game: string, amount: number) {
    const limitedAmount = Math.min(amount, 1000);

    const data = await getConnection("replica")
        .createQueryBuilder(GameFeed, "rgs_game_feed")
        .select("rgs_game_feed.data", "data")
        .leftJoin(Round, "rgs_round", "rgs_round.roundId = rgs_game_feed.roundId")
        .where("rgs_game_feed.game = :game", {game})
        .andWhere("rgs_round.status = :status", {status: "finished"})
        .orderBy({"rgs_game_feed.id": "DESC"})
        .limit(limitedAmount)
        .getRawMany();

    return {feed: data.map(entry => entry.data)};
}
