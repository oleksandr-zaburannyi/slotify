import {Round} from "../db/model/Round";
import {Wager} from "../db/model/Wager";
import complete from "./complete";
import {IPlayer} from "./authenticate";

export default async function recover(player: Omit<IPlayer, "sessionId" | "nativeId">, provider: string, game: string, channel: string | undefined, ip: string, immediateComplete: boolean = false) {
    const rounds: Awaited<ReturnType<typeof Round.mapRoundToPlayer>>[] = [];
    for (const round of await Round.getStartedFromUser(["started"], player.playerId, provider, game)) {
        round.wagers = await Wager.getByRoundId(round.roundId);

        const lastWager = round.wagers[round.wagers.length - 1];
        if (!lastWager) continue;

        if (immediateComplete && lastWager && !Wager.hasNextAction(lastWager)) {
            await complete(player, round.roundId, true, channel, ip, false, 0);
        } else {
            rounds.push(await Round.mapRoundToPlayer(round));
        }
    }
    return {rounds};
}
