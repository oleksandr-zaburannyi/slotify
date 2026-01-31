import logger from "@slotify/shared/lib/logger";
import {Round} from "../db/model/Round";
import {Wager} from "../db/model/Wager";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getRoundRngState, updateRoundRngCursor} from "../util/provablyFairUtil";
import {cancelRound, IPlayRequest, playRequest} from "./play";
import {getBetLimits, getGameBets} from "../util/betUtil";
import {gamesService} from "../util/gamesUtil";
import Exception from "@slotify/shared/lib/Exception";
import {getPlayerDetails} from "../util/adapterUtil";
import complete from "./complete";
import {unsheduleTask} from "@slotify/shared/lib/scheduler";
import {promoPlay} from "../util/promoUtil";
import {IPlayer} from "./authenticate";

const autocompletionStepsLimit = process.env.AUTOCOMPLETION_STEPS_LIMIT ? parseInt(process.env.AUTOCOMPLETION_STEPS_LIMIT) : 1000;

export async function autoCompleteRound(roundId: string) {
    const round = await Round.getWithWagers(roundId);
    if (!round) throw new Exception("Couldn't find round to auto complete");
    const playerDetails = {...(await getPlayerDetails(round.playerId)), provider: round.provider, game: round.game};
    const player = {playerId: round.playerId, ...playerDetails};

    await autoPlay(round, player);
    await complete(player, round.roundId, true, undefined, undefined, true, null);
}

export async function autoPlay(round: Round, player: Omit<IPlayer, "sessionId">) {
    const roundId = round.roundId;
    logger.info(`${roundId} round status (${round.status})`);

    const settingsFilter = {
        wallet: player.wallet,
        operator: player.operator,
        brand: player.brand,
        provider: round.provider,
        game: round.game,
        jurisdiction: player.jurisdiction,
        currency: player.currency,
    };

    if (round.wagers.length === 0) {
        logger.info(`${round.roundId} round has no wagers`);
        await Round.fail(roundId, "no wagers generated");
        await unsheduleTask("autoComplete", roundId);
        await cancelRound(settingsFilter, round.roundId, true, 0);
        return;
    }

    if (round.status === "started") {
        let wager: Wager = round.wagers[round.wagers.length - 1];
        let step = round.wagers.length;
        const game = round.game;
        const provider = round.provider;
        const variant = round.variant;
        const bets = await getGameBets(provider, game, variant);
        const firstWager = round.wagers[0];
        const bet = firstWager.bet!;
        const coin = bets[firstWager.action].coin;

        if (!bets[firstWager.action]) {
            logger.error("Action not implemented", {wager: firstWager});
            return;
        }

        while (wager.next && wager.next.length > 0) {
            if (step > autocompletionStepsLimit) {
                logger.error("Round autocompletion exceeds steps limit signifying game server malfunction", {roundId, game, provider, wager, firstWager});
                break;
            }

            logger.info(`Adding wager to round ${roundId}, step ${step}, next ${wager.next?.join(",")}`);
            const {win, data, state, next, action, params} = wager;
            const actionResponse = await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/action`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({bet, action, params, variant, coin, win, data, state, next}),
            });
            if (!next.includes(actionResponse.action)) {
                logger.error("Action not included in next", {wager: firstWager});
                return;
            }

            const roundRngState = await getRoundRngState(settingsFilter, round.playerId, roundId, game);

            const betLimits = await getBetLimits(settingsFilter.currency!, settingsFilter, {});
            const request: IPlayRequest = {bet, coin, state, variant, action: actionResponse.action, params: actionResponse.params, roundRngState, betLimits};
            const response = await playRequest(provider, game, {...request, promo: null}, betLimits.currencyDecimals);
            wager = await Wager.create({step, roundId, ...request, ...response, auto: true, bet: undefined}).save();

            if (response.campaigns) {
                await promoPlay(player, provider, game, roundId, step, response.campaigns);
            }

            await updateRoundRngCursor(roundId, roundRngState, response.rngPayload, !Wager.hasNextAction(wager));

            round.wagers.push(wager);
            step++;
        }
        round.status = "unpaid";
        await round.save();
    }

    await unsheduleTask("autoComplete", roundId);
}
