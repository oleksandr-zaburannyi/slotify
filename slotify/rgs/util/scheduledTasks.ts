import {Round} from "../db/model/Round";
import {getNextCronTimestamp, hasTask, registerSchedulerCallback, scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {Wager} from "../db/model/Wager";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {DrawWin} from "../db/model/DrawWin";
import {Draw} from "../db/model/Draw";
import {Room} from "../db/model/Room";
import {Command} from "../db/model/Command";
import logger from "@slotify/shared/lib/logger";
import Exception from "@slotify/shared/lib/Exception";
import complete from "../route/complete";
import {cancelRound} from "../route/play";
import {payDrawWin} from "../multiplayer/tick";
import {cancelCommand} from "../multiplayer/command";
import {getPlayerDetails} from "./adapterUtil";
import {autoPlay} from "../route/autoCompleteRound";
import {verifyCriticalFiles} from "../compliance/critical-files/verification";
import {calculateRtps} from "../compliance/rtp/rtpResolvers";
import {archiveMultiplayer, archiveSinglePlayer} from "../route/archive";

async function scheduleAutoComplete() {
    for (const {roundId, playerId, provider, game, createdAt} of await Round.getByStatus(["started"])) {
        try {
            if (await hasTask("autoComplete", roundId)) continue;

            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
            if (!(await Settings.isAutoCompleteEnabled(settingsFilter))) continue;

            const lastWagerDate = await Wager.getLastWagerDate(roundId);
            const timestamp = (await Settings.getAutoCompleteTimestamp(settingsFilter)) - Date.now() + (lastWagerDate || createdAt).getTime();

            await scheduleTask("autoComplete", roundId, timestamp, {roundId});
        } catch (e) {
            logger.warn("Couldn't schedule auto complete task", {roundId, error: e});
        }
    }
}

async function scheduleRetryDeposit() {
    for (const {roundId, playerId, provider, game, completedAt, updatedAt} of await Round.getByStatus(["unpaid"])) {
        try {
            if (await hasTask("retryDeposit", roundId)) continue;

            const retry = 0;
            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};

            if (await Settings.hasRetriesExpired(completedAt || updatedAt, settingsFilter)) continue;

            await scheduleTask("retryDeposit", roundId, await Settings.getNextDepositRetryTimestamp(settingsFilter, retry), {roundId, retry});
        } catch (e) {
            logger.warn("Couldn't schedule retry deposit task", {roundId, error: e});
        }
    }
}

async function scheduleRetryCancel() {
    for (const {roundId, playerId, provider, game, failedAt, createdAt} of await Round.getByStatus(["failed"])) {
        try {
            if (await hasTask("retryCancel", roundId)) continue;

            const retry = 0;
            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
            const timestamp = await Settings.getNextCancelRetryTimestamp(settingsFilter, retry);
            const lastWagerDate = await Wager.getLastWagerDate(roundId);

            if (await Settings.hasRetriesExpired(failedAt || lastWagerDate || createdAt, settingsFilter)) return;

            await scheduleTask("retryCancel", roundId, timestamp, {roundId, retry});
        } catch (e) {
            logger.warn("Couldn't schedule retry cancel task", {roundId, error: e});
        }
    }
}

async function scheduleRetryDrawWin() {
    for (const {drawWinId, playerId, drawId, createdAt} of await DrawWin.getByStatus(["unpaid"])) {
        try {
            if (await hasTask("retryDrawWin", drawWinId)) continue;

            const retry = 0;
            const draw = await Draw.findOneByOrFail({drawId});
            const {provider, game} = await Room.getByIdOrFail(draw.roomId);
            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
            if (await Settings.hasRetriesExpired(createdAt, settingsFilter)) return;

            await scheduleTask("retryDrawWin", drawWinId, await Settings.getNextDepositRetryTimestamp(settingsFilter, retry), {drawWinId, retry});
        } catch (e) {
            logger.warn("Couldn't schedule retry draw win task", {drawWinId, error: e});
        }
    }
}

async function scheduleRetryCancelCommand() {
    for (const {roomId, commandId, playerId, createdAt} of await Command.getByStatus(["failed", "finishing"])) {
        try {
            if (await hasTask("retryCancelCommand", commandId)) continue;

            const retry = 0;
            const {provider, game} = await Room.getByIdOrFail(roomId);
            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
            if (await Settings.hasRetriesExpired(createdAt, settingsFilter)) return;

            await scheduleTask("retryCancelCommand", commandId, await Settings.getNextCancelRetryTimestamp(settingsFilter, retry), {commandId, retry});
        } catch (e) {
            logger.warn("Couldn't schedule retry cancel command task", {commandId, error: e});
        }
    }
}

async function scheduleRehydrateRetries() {
    await scheduleTask("rehydrateRetries", "cron", getNextCronTimestamp("0 * * * *"), {});
}

async function scheduleVerifyCriticalFiles() {
    await scheduleTask("verifyCriticalFiles", "cron", getNextCronTimestamp("0 6,18 * * *"), {});
}

async function scheduleCalculateRtps() {
    await scheduleTask("calculateRtps", "cron", getNextCronTimestamp("0 * * * *"), {});
}

async function scheduleArchiveRgs() {
    if (!(await hasTask("archiveRgsSinglePlayer", "cron"))) {
        await scheduleTask("archiveRgsSinglePlayer", "cron", 0, {});
    }
    if (!(await hasTask("archiveRgsMultiPlayer", "cron"))) {
        await scheduleTask("archiveRgsMultiPlayer", "cron", 0, {});
    }
}

export default async function scheduledTasks(): Promise<void> {
    await scheduleRehydrateRetries();
    await scheduleVerifyCriticalFiles();
    await scheduleCalculateRtps();
    await scheduleArchiveRgs();
}

registerSchedulerCallback("rehydrateRetries", async () => {
    logger.info("rehydrateRetries started");
    await scheduleAutoComplete();
    await scheduleRetryDeposit();
    await scheduleRetryCancel();
    await scheduleRetryDrawWin();
    await scheduleRetryCancelCommand();

    await scheduleRehydrateRetries();
});

registerSchedulerCallback(
    "autoComplete",
    async ({roundId}) => {
        logger.info(`Auto completing round ${roundId}`);
        const round = await Round.getWithWagers(roundId);
        if (!round) {
            await unsheduleTask("autoComplete", roundId);
            logger.warn(`Unscheduling autoComplete due to round entry missing, roundId ${roundId}`);
            return;
        }
        const {playerId, provider, game} = round;
        const playerDetails = await getPlayerDetails(playerId);

        if (["finished", "cancelled", "failed", "unpaid"].includes(round.status) || !(await Settings.isAutoCompleteEnabled({provider, game, ...playerDetails}))) {
            await unsheduleTask("autoComplete", roundId);
            return;
        }

        await autoPlay(round, {playerId, ...playerDetails});
        await scheduleTask("retryDeposit", roundId, Date.now(), {roundId, retry: 0});
    },
    {timeout: 60 * 60 * 1000},
);

registerSchedulerCallback("retryDeposit", async ({roundId, retry}) => {
    retry++;
    const round = await Round.findOneBy({roundId});
    if (!round) {
        await unsheduleTask("retryDeposit", roundId);
        throw new Exception("Couldn't find round to retry deposit");
    }
    const {playerId, provider, game, status, updatedAt} = round;
    const settingsFilter = {...(await getPlayerDetails(playerId)), provider, game};

    if (status !== "unpaid") {
        await unsheduleTask("retryDeposit", roundId);
        logger.warn(`Unscheduling retryDeposit called on a Round not in unpaid state, roundId ${roundId}, status ${status}, retry ${retry}`, {round});
        return;
    } else {
        if (await Settings.hasRetriesExpired(updatedAt, settingsFilter)) {
            await unsheduleTask("retryDeposit", roundId);
            logger.info(`Unscheduling retryDeposit due to retries expiry, roundId ${roundId}, retry ${retry}`, {round});
            return;
        }
    }

    logger.info(`Retrying deposit of round ${roundId}, ${retry} retry`);
    await complete({...settingsFilter, playerId}, roundId, true, undefined, undefined, true, retry);
});

registerSchedulerCallback("retryCancel", async ({roundId, retry}) => {
    retry++;
    const round = await Round.findOneBy({roundId});
    if (!round) {
        await unsheduleTask("retryCancel", roundId);
        return;
    }
    const {playerId, provider, game, status, createdAt} = round;
    const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
    const lastWagerDate = await Wager.getLastWagerDate(roundId);

    if (status !== "failed" || (await Settings.hasRetriesExpired(lastWagerDate || createdAt, settingsFilter))) {
        await unsheduleTask("retryCancel", roundId);
        return;
    }

    logger.info(`Retrying cancel of round ${roundId}, ${retry} retry`);
    await cancelRound(settingsFilter, roundId, true, retry);
});

registerSchedulerCallback("retryDrawWin", async ({drawWinId, retry}) => {
    retry++;
    const drawWin = await DrawWin.findOneByOrFail({drawWinId});
    const draw = await Draw.findOneByOrFail({drawId: drawWin.drawId});
    const room = await Room.getByIdOrFail(draw.roomId);
    const {provider, game} = room;

    const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(drawWin.playerId)), provider, game};

    if (drawWin.status !== "unpaid" || (await Settings.hasRetriesExpired(drawWin.createdAt, settingsFilter))) {
        await unsheduleTask("retryDrawWin", drawWinId);
        return;
    }

    logger.info(`Retrying draw win ${drawWinId}, ${retry} retry`);
    await payDrawWin(drawWin, room, retry);
});

registerSchedulerCallback("retryCancelCommand", async ({commandId, retry}) => {
    retry++;
    const command = await Command.findOneByOrFail({commandId});
    const {provider, game} = await Room.getByIdOrFail(command.roomId);

    const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(command.playerId)), provider, game};

    if (command.withdrawalStatus !== "failed" || (await Settings.hasRetriesExpired(command.createdAt, settingsFilter))) {
        await unsheduleTask("retryCancelCommand", commandId);
        return;
    }

    logger.info(`Retrying cancel command ${commandId}, ${retry} retry`);
    await cancelCommand(command.commandId, true, retry);
});

registerSchedulerCallback("verifyCriticalFiles", async () => {
    logger.info("verifyCriticalFiles started");
    await verifyCriticalFiles().catch(error => logger.error(error));
    await scheduleVerifyCriticalFiles();
});

registerSchedulerCallback("calculateRtps", async () => {
    logger.info("calculateRtps started");
    await calculateRtps();
    await scheduleCalculateRtps();
});

registerSchedulerCallback("archiveRgsMultiPlayer", async () => {
    logger.info("archiveRgsMultiPlayer started");
    const scheduleAsap = await archiveMultiplayer();

    const time = Date.now() + (scheduleAsap ? 500 : 5 * 60 * 1000); //500ms or 5 minutes

    await scheduleTask("archiveRgsMultiPlayer", "cron", time, {});
});

registerSchedulerCallback("archiveRgsSinglePlayer", async () => {
    logger.info("archiveRgsSinglePlayer started");
    const scheduleAsap = await archiveSinglePlayer();

    const time = Date.now() + (scheduleAsap ? 500 : 5 * 60 * 1000); //500ms or 5 minutes

    await scheduleTask("archiveRgsSinglePlayer", "cron", time, {});
});
