import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import {Round} from "../db/model/Round";
import {Wager} from "../db/model/Wager";
import {formatRoundRgsTransactionId, ITransaction, shouldIgnoreDepositError, transactionRequest} from "../util/adapterUtil";
import regulatory from "./regulatory";
import {calculateFinalWin, winRatio} from "../util/roundUtil";
import {IPlayer} from "./authenticate";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import logger from "@slotify/shared/lib/logger";
import {lock, unlock} from "@slotify/shared/lib/lock";
import {serviceMetrics} from "../util/metrics";

export default async function complete(
    player: Omit<IPlayer, "sessionId" | "nativeId">,
    roundId: string,
    asyncWin: boolean,
    channel: string | undefined,
    ip: string | undefined,
    auto: boolean,
    retry: number | null,
): Promise<{balance?: number; finalWin: number; popups?: IExceptionPopup[]}> {
    const {operator, brand, currency, playerId, wallet, jurisdiction} = player;

    if (!(await lock(`complete-lock:${roundId}`, 60000))) throw new Exception("Round completion in progress");

    const round = await Round.findOneByOrFail({roundId});
    if (!["unpaid", "started"].includes(round.status)) throw new Exception("Round needs to be in unpaid or started state to complete it", {data: {roundId, playerId}});
    if (round.playerId !== playerId) throw new Exception("Incorrect playerId", {data: {roundId, playerId}});

    const lastWager: Pick<Wager, "next" | "roundId"> | null = await Wager.findOne({select: ["next", "roundId"], where: {roundId}, order: {createdAt: "DESC"}});
    if (!lastWager) throw new Exception("Round needs to have at least one wager to complete it");
    if (Wager.hasNextAction(lastWager)) throw new Exception("Round has next actions to use", {data: {roundId}});

    const settingsFilter = {game: round!.game, brand, jurisdiction, wallet, provider: round!.provider, operator, currency};

    const totalWin = await Wager.getTotalWin(roundId);
    const finalWin = await calculateFinalWin(totalWin, settingsFilter);
    const {action, bet}: Pick<Wager, "action" | "bet"> = (await Wager.findOne({select: ["action", "bet"], where: {roundId}, order: {createdAt: "ASC"}}))!;

    const {provider, game, variant} = round!;
    const winRatioResult = await winRatio(provider, game, variant, action, bet!, totalWin);
    serviceMetrics.recordRoundPayout(winRatioResult, game, provider!, operator);
    const transaction: ITransaction = {
        amount: finalWin,
        type: "deposit",
        roundId,
        provider,
        game,
        variant,
        category: "normal",
        roundFinished: true,
        channel,
        name: action,
        winRatio: winRatioResult,
        ip,
        regulatory: await regulatory(roundId, jurisdiction),
    };

    await unsheduleTask("autoComplete", roundId);

    if ((await Settings.allowParallelRounds(settingsFilter)) && asyncWin) {
        // silencing the error due to sendDeposit already logging the error
        sendDeposit(round, transaction, auto, settingsFilter, retry).catch(() => null);
        return {finalWin};
    } else {
        const {balance, popups} = await sendDeposit(round, transaction, auto, settingsFilter, retry);
        return {finalWin, balance, popups};
    }
}

async function sendDeposit({roundId, status, playerId}: Round, transaction: ITransaction, auto: boolean, settingsFilter: ISettingsFilter, retry: number | null) {
    try {
        const {balance, popups} = await transactionRequest(formatRoundRgsTransactionId("win", roundId), playerId, transaction, auto);
        await unsheduleTask("retryDeposit", roundId);
        await Round.update({roundId}, {status: "finished"});
        return {balance, popups};
    } catch (error) {
        if (shouldIgnoreDepositError(error)) {
            await unsheduleTask("retryDeposit", roundId);
            await Round.update({roundId}, {status: "finished"});
            logger.info(`Unscheduling retryDeposit due to non retriable deposit error ${roundId}, retry ${retry}`, {error});
        } else {
            if (retry !== null) {
                await scheduleTask("retryDeposit", roundId, await Settings.getNextDepositRetryTimestamp(settingsFilter, retry), {roundId, retry});
            }
            if (status !== "unpaid") {
                await Round.update({roundId}, {status: "unpaid"});
            }
        }
        throw error;
    } finally {
        await unlock(`complete-lock:${roundId}`);
    }
}
