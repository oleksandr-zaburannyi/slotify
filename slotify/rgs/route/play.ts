import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {Round} from "../db/model/Round";
import {Wager} from "../db/model/Wager";
import {blockPlayer, cancelRoundRequest, formatRoundRgsTransactionId, shouldCancelOnWithdrawError, shouldIgnoreCancelError, transactionRequest} from "../util/adapterUtil";
import logger from "@slotify/shared/lib/logger";
import {floor} from "@slotify/shared/lib/floor";
import {IPlayer} from "./authenticate";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {GameFeed} from "../db/model/GameFeed";
import {getBetLimits, getBets, getGameBets, IBet, IBetLimits, isBetAvailable} from "../util/betUtil";
import {getSessionData, getSessionSettings, ISessionData} from "../util/sessionUtil";
import {gamesService} from "../util/gamesUtil";
import complete from "./complete";
import {closeRoundRngState, getRoundRngState, RoundRngState, updateRoundRngCursor} from "../util/provablyFairUtil";
import {scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {Currency} from "../db/model/Currency";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {v4} from "uuid";
import {In} from "typeorm";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import {sendAlert} from "@slotify/shared/lib/sendAlert";
import {executeInQueue} from "@slotify/shared/lib/queue";
import {serviceMetrics} from "../util/metrics";
import {promoPlay, updatePromoWin} from "../util/promoUtil";

export type IPlayRequest = {
    bet: number;
    sideBet?: number;
    coin: number;
    action: string;
    params?: any;
    state: any;
    variant?: string;
    roundRngState?: RoundRngState;
    cheat?: string;
    betLimits: IBetLimits;
};

type IBetResponse = {
    balance: number | undefined;
    promo: any | null;
    popups?: IExceptionPopup[];
};

export type IPlayResponse = Pick<Wager, "win" | "state" | "data" | "next"> & {
    feed?: any;
    campaigns?: any;
    rngPayload?: {
        newRngCursor: number;
    };
};

type IPlayData = {
    player: IPlayer;
    settingsFilter: ISettingsFilter;
    bets: Record<string, IBet>;
    action: string;
    bet: number | undefined;
    currency: string;
    decimals: number;
    rate: number;
    sessionData: ISessionData;
    provider: string;
    game: string;
    variant: string | undefined;
    params: any;
    channel: string | undefined;
    ip: string;
    cheat: string;
    roundId: string;
    betLimits: IBetLimits;
};

async function initRound(settingsFilter: ISettingsFilter, playerId: string, provider: string, game: string, roundId: string, variant: string | undefined) {
    const allowParallelRounds = await Settings.allowParallelRounds(settingsFilter);

    if (allowParallelRounds) {
        await Round.insert({roundId, provider, game, playerId, status: "started", variant, active: false});
    } else {
        await executeInQueue(`round-init:${playerId}:${game}`, async () => {
            const unfinishedRound = await Round.findOne({where: {playerId, provider, game, status: In(["started", "unpaid", "force-index-scan"])}, order: {id: "DESC"}});
            if (unfinishedRound) {
                const expiryThreshold = await Settings.getRetryExpired(settingsFilter);
                if (unfinishedRound.status === "unpaid" && unfinishedRound.updatedAt.getTime() < expiryThreshold.getTime()) {
                    logger.warn(`Active unpaid round is expired (initializing new round), roundId ${unfinishedRound.roundId}`, {data: {unfinishedRound, expiryThreshold}});
                } else {
                    // throw when round is either "started" or unexpired-"unpaid"
                    throw new Exception(`Unfinished round needs to be finished before starting next one, roundId ${unfinishedRound.roundId}`, {data: {unfinishedRound}});
                }
            }
        });
        await Round.insert({roundId, provider, game, playerId, status: "started", variant, active: false});
    }
}

async function customValidateInitialPlay(
    playerId: string,
    provider: string,
    game: string,
    variant: string | undefined,
    action: string,
    currency: string,
    playRequest: Omit<IPlayRequest, "state">,
    settingsFilter: ISettingsFilter,
    sessionData: ISessionData,
    roundId: string,
) {
    if ((await getGameBets(provider, game, variant))[action].validate) {
        const allowParallelRounds = await Settings.allowParallelRounds(settingsFilter);
        if (allowParallelRounds) throw new Exception("Parallel rounds not supported for initial bets with custom validation");
        try {
            const state = await Wager.getLatestState(playerId, game);
            await customValidation(provider, game, currency, {...playRequest, state}, settingsFilter, sessionData);
        } catch (e) {
            await Round.update({roundId}, {status: "cancelled"});
            throw e;
        }
    }
}

async function runInitialPlay(
    player: IPlayer,
    step: number,
    roundId: string,
    provider: string,
    game: string,
    bet: number,
    variant: string | undefined,
    channel: string | undefined,
    action: string,
    ip: string,
    settingsFilter: ISettingsFilter,
    playRequest: Omit<IPlayRequest, "state">,
    decimals: number,
    betLimits: IBetLimits,
) {
    const playerId = player.playerId;
    let betResponse: IBetResponse;
    try {
        betResponse = await sendBet(step, roundId, playerId, provider, game, bet, variant, channel, action, ip);
    } catch (error) {
        if (shouldCancelOnWithdrawError(error)) {
            await Round.fail(roundId, `error during withdrawal (${error instanceof Exception ? error.message : "-"})`);
            // silencing the error due to cancelRound already logging the error
            cancelRound(settingsFilter, roundId, false, 0).catch(() => null);
        } else {
            await Round.update({roundId}, {status: "cancelled"});
        }
        throw error;
    }

    try {
        return await executeInQueue(`play-lock:${playerId}:${game}`, async () => {
            const activeRound = await Round.findOne({select: ["roundId"], where: {provider, game, playerId, active: true}});

            let state;
            if (activeRound) {
                const lastWager: Pick<Wager, "state" | "next"> | null = await Wager.findOne({select: ["id", "next", "state"], where: {roundId: activeRound.roundId}, order: {id: "DESC"}});

                if (lastWager && Wager.hasNextAction(lastWager)) {
                    throw new Exception("Another round waits for next actions");
                }
                state = lastWager?.state;
            }
            const wager = await sendPlay(player, settingsFilter, bet, roundId, step, provider, game, {...playRequest, state, promo: betResponse.promo, betLimits}, decimals);

            await getConnection("primary").transaction(async transactionalEntityManager => {
                await transactionalEntityManager.update(Round, {provider, game, playerId, active: true}, {active: false});
                await transactionalEntityManager.update(Round, {roundId}, {active: true, prevRoundId: activeRound?.roundId});
            });

            return {wager: wager!, betResponse};
        });
    } catch (error) {
        await Round.fail(roundId, `error during game execution (${error instanceof Exception ? error.message : "-"})`);
        await cancelRound(settingsFilter, roundId, false, 0);
        throw error instanceof Exception ? error : new Exception("Couldn't play the game", {data: {error, game, playerId}});
    }
}

async function playInitial({player, roundId, settingsFilter, bets, action, bet, currency, decimals, sessionData, game, variant, params, provider, channel, ip, cheat, betLimits}: IPlayData) {
    validateInitialPlay(bet, decimals, bets, action);
    const playerId = player.playerId;
    const step = 0;

    await initRound(settingsFilter, playerId, provider, game, roundId, variant);

    const playRequest: Omit<IPlayRequest, "state"> = {bet: bet!, action, params, coin: bets[action].coin, variant, cheat, betLimits};
    await customValidateInitialPlay(playerId, provider, game, variant, action, currency, playRequest, settingsFilter, sessionData, roundId);

    return await runInitialPlay(player, step, roundId, provider, game, bet!, variant, channel, action, ip, settingsFilter, playRequest, decimals, betLimits);
}

async function makeSideBet(
    bet: number | undefined,
    provider: string,
    game: string,
    currency: string,
    playRequest: IPlayRequest,
    settingsFilter: ISettingsFilter,
    sessionData: ISessionData,
    step: number,
    roundId: string,
    playerId: string,
    round: Round,
    channel: string | undefined,
    action: string,
    ip: string,
) {
    let betResponse: IBetResponse | undefined = undefined;
    if (bet) {
        validateBet(bet);
        await customValidation(provider, game, currency, playRequest, settingsFilter, sessionData);

        try {
            betResponse = await sendBet(step, roundId, playerId, provider, game, bet, round.variant, channel, action, ip);
        } catch (error) {
            throw new Exception("Couldn't make the side bet", {data: {game, roundId, error}});
        }
    }
    return betResponse;
}

async function runNextPlay(player: IPlayer, settingsFilter: ISettingsFilter, bet: number | undefined, roundId: string, step: number, provider: string, game: string, playRequest: IPlayRequest, promo: any, decimals: number) {
    try {
        return await sendPlay(player, settingsFilter, bet, roundId, step, provider, game, {...playRequest, promo}, decimals);
    } catch (error) {
        throw new Exception("Couldn't play the game", {data: {game, roundId, error}});
    }
}

async function playNext({player, settingsFilter, bets, action, bet, currency, decimals, sessionData, game, provider, params, roundId, channel, ip, cheat, betLimits}: IPlayData) {
    const playerId = player.playerId;
    return await executeInQueue(`round-next-init:${playerId}:${game}`, async () => {
        const round = await Round.findOneByOrFail({roundId: roundId});
        const firstWager: Pick<Wager, "action" | "bet"> = await Wager.findOneOrFail({select: ["action", "bet"], where: {roundId}, order: {id: "ASC"}});
        const lastWager: Pick<Wager, "step" | "state" | "next"> = await Wager.findOneOrFail({select: ["step", "state", "next"], where: {roundId}, order: {id: "DESC"}});
        const step = lastWager.step! + 1;

        validateNextPlays(round, lastWager.next, game, roundId, playerId, action);

        const playRequest = {bet: firstWager.bet!, sideBet: bet, action, params, coin: bets[firstWager.action].coin, state: lastWager.state, variant: round.variant, cheat, betLimits};
        const betResponse = await makeSideBet(bet, provider, game, currency, playRequest, settingsFilter, sessionData, step, roundId, playerId, round, channel, action, ip);
        const wager = await runNextPlay(player, settingsFilter, bet, roundId, step, provider, game, playRequest, betResponse?.promo, decimals);
        return {wager, betResponse};
    });
}

export default async function play(
    player: IPlayer,
    provider: string,
    game: string,
    roundId: string | undefined,
    bet: number | undefined,
    action: string,
    params: any,
    cheat: string,
    channel: string | undefined,
    ip: string,
    immediateComplete: boolean = false,
    asyncWin: boolean = false,
): Promise<{
    roundId: string;
    wager?: IPlayResponse;
    balance: number | undefined;
    finalWin?: number;
    popups?: IExceptionPopup[];
    complete?: Awaited<ReturnType<typeof complete>>;
}> {
    const {operator, brand, currency, playerId, wallet, jurisdiction, sessionId} = player;
    const settingsFilter: ISettingsFilter = {provider, game, brand, jurisdiction, wallet, operator, currency};

    if (!(await Settings.isGameEnebled(settingsFilter))) throw new Exception("Game not enabled", {code: "GAME_NOT_AVAILABLE"});

    const sessionData = await getSessionData(sessionId);
    const settings = await getSessionSettings(settingsFilter, sessionData);
    const bets = await getBets(provider, game, settings.gameVariant, currency, wallet, operator, brand, jurisdiction, sessionData);
    const isInitialPlay = !roundId;
    roundId = roundId || v4();
    const {decimals, rate} = await Currency.getFixedRate(currency, settingsFilter);
    const betLimits = await getBetLimits(currency, settingsFilter, sessionData);

    const playData: IPlayData = {player, settingsFilter, bets, action, bet, currency, decimals, rate, sessionData, roundId, cheat, ip, channel, provider, game, variant: settings.gameVariant, params, betLimits};
    serviceMetrics.registerPlayerId(playerId);
    try {
        const {betResponse, wager} = isInitialPlay ? await playInitial(playData) : await playNext(playData);
        if (isInitialPlay) serviceMetrics.recordBet(game, currency, provider, operator);

        if (await Settings.isAutoCompleteEnabled(settingsFilter)) {
            await scheduleTask("autoComplete", roundId, await Settings.getAutoCompleteTimestamp(settingsFilter), {roundId});
        }

        return {
            roundId,
            wager,
            popups: betResponse?.popups,
            balance: betResponse?.balance,
            complete: immediateComplete && !Wager.hasNextAction(wager) ? await complete(player, roundId, asyncWin, channel, ip, false, 0) : undefined,
        };
    } catch (error) {
        if (!isDevMode() && error instanceof Exception && error.code === "VALIDATION_FAILED") {
            const {wasBlocked} = await blockPlayer(playerId);
            if (!wasBlocked) {
                sendAlert(
                    "Player blocked",
                    `Player has been blocked due to usage of incorrect API (${error.message})<br/>
                    Player Id: ${playerId}<br/>
                    Player nativeId: ${player.nativeId}<br/>
                    Player nickname: ${player.nickname}<br/>
                    Game: ${game}<br/>
                    Wallet: ${wallet}<br/>
                    Operator: ${operator}<br/>
                    Brand: ${brand}<br/><br/>
                    <a href="${process.env.URL}/backoffice/rounds/${roundId}">Open in Back office</a><br/>
                    `,
                );
            }
        }
        throw error;
    }
}

function validateBet(bet: number | undefined) {
    if (typeof bet !== "number") {
        throw new Exception("Bet must be specified");
    }
    if (bet < 0) {
        throw new Exception("Bet must be greater or equal to 0", {code: "VALIDATION_FAILED"});
    }
}

export function validateInitialPlay(bet: number | undefined, decimals: number, bets: Record<string, IBet>, action: string) {
    validateBet(bet);
    if (!bets[action]) {
        throw new Exception("Action not defined", {data: {bet, action, bets}});
    }
    if (!isBetAvailable(bets[action].available, decimals, bet!)) {
        throw new Exception("Bet not available", {data: {bet, action, bets}});
    }
}

function validateNextPlays(round: Round, next: string[] | undefined, game: string, roundId: string, playerId: string, action: string) {
    if (round.status !== "started") throw new Exception("Round should be in started state in order to continue", {data: {roundId}});
    if (round.playerId !== playerId) throw new Exception("Incorrect player", {data: {roundId}});
    if (round.game !== game) throw new Exception("Incorrect game", {data: {roundId}});

    if (!next || next.indexOf(action) < 0) {
        throw new Exception("Couldn't find action in 'next'", {data: {roundId, playerId, action}});
    }
}

export async function sendPlay(
    player: IPlayer,
    settingsFilter: ISettingsFilter,
    bet: number | undefined,
    roundId: string,
    step: number,
    provider: string | undefined,
    game: string,
    request: IPlayRequest & {
        promo: any;
        cheat?: string;
    },
    decimals: number,
): Promise<Pick<Wager, "win" | "state" | "data" | "next" | "promo">> {
    const roundRngState = await getRoundRngState(settingsFilter, player.playerId, roundId, game);
    let {win, state, data, next, feed, rngPayload, campaigns} = await playRequest(provider, game, {...request, roundRngState}, decimals);
    await updateRoundRngCursor(roundId, roundRngState, rngPayload, !Wager.hasNextAction({next}));

    let promo = request.promo;
    if (campaigns) {
        promo = {...request.promo, ...(await promoPlay(player, provider, game, roundId, step, campaigns))};
    }

    win = updatePromoWin(win, promo);

    await Wager.insert({step, win, state, data, next, roundId, bet, action: request.action, params: request.params, promo, auto: false});

    if (feed != null) {
        await GameFeed.insert({game, roundId, wagerStep: step, data: feed});
    }

    return {win, state: removeUnderscoredKeys(state), data, next, promo};
}

async function sendBet(step: number, roundId: string, playerId: string, provider: string, game: string, amount: number, variant: string | undefined, channel: string | undefined, name: string, ip: string) {
    const rgsTransactionId = formatRoundRgsTransactionId("bet", roundId, step);
    return await transactionRequest(rgsTransactionId, playerId, {type: "withdraw", roundId, category: "normal", provider, game, amount, roundFinished: false, variant, channel, name, ip}, false);
}

export async function playRequest(
    provider: string | undefined,
    game: string,
    request: IPlayRequest & {
        promo: any;
        cheat?: string;
    },
    decimals: number,
): Promise<IPlayResponse> {
    const {win, state, data, next, feed, rngPayload, campaigns} = await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/play`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(request),
    });
    return {win: floor(win, decimals), state, data, next, feed, rngPayload, campaigns};
}

export async function customValidation(provider: string | undefined, game: string, currency: string, request: IPlayRequest, settingsFilter: ISettingsFilter, sessionData: ISessionData) {
    const betLimits = await getBetLimits(currency, settingsFilter, sessionData);

    const {valid} = await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/validate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({...request, betLimits})});
    if (!valid) throw new Exception("Bet validation failed", {code: "VALIDATION_FAILED"});
}

export async function cancelRound(
    settingsFilter: ISettingsFilter,
    roundId: string,
    auto: boolean,
    retry: number | null,
): Promise<void | {
    balance: number;
}> {
    try {
        await closeRoundRngState(settingsFilter, roundId);
        const balance = await cancelRoundRequest(roundId, auto);
        await unsheduleTask("retryCancel", roundId);
        await Round.update({roundId}, {status: "cancelled"});
        return {balance};
    } catch (e) {
        if (shouldIgnoreCancelError(e)) {
            await unsheduleTask("retryCancel", roundId);
            await Round.update({roundId}, {status: "cancelled"});
        } else {
            if (retry !== null) await scheduleTask("retryCancel", roundId, await Settings.getNextCancelRetryTimestamp(settingsFilter, retry), {roundId, retry});
            logger.warn("canceling round failed", {roundId, error: e});
            throw e;
        }
    }
}
