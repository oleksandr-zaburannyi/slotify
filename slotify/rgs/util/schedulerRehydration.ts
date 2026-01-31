import {Round} from "../db/model/Round";
import {getNextCronTimestamp, hasTask, registerSchedulerCallback, scheduleTask} from "@slotify/shared/lib/scheduler";
import {Wager} from "../db/model/Wager";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {DrawWin} from "../db/model/DrawWin";
import {Draw} from "../db/model/Draw";
import {Room} from "../db/model/Room";
import {Command} from "../db/model/Command";
import logger from "@slotify/shared/lib/logger";
import {getPlayerDetails} from "./adapterUtil";

export function registerRehydrateCallback(): void {
    registerSchedulerCallback("rehydrateRetries", async () => {
        logger.info("rehydrateRetries started");
        await rehydrateAutoComplete();
        await rehydrateRetryDeposit();
        await rehydrateRetryCancel();
        await rehydrateRetryDrawWin();
        await rehydrateRetryCancelCommand();

        await scheduleTask("rehydrateRetries", "cron", getNextCronTimestamp("0 * * * *"), {});
    });
}

async function rehydrateAutoComplete(): Promise<void> {
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

async function rehydrateRetryDeposit(): Promise<void> {
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

async function rehydrateRetryCancel(): Promise<void> {
    for (const {roundId, playerId, provider, game, failedAt, createdAt} of await Round.getByStatus(["failed"])) {
        try {
            if (await hasTask("retryCancel", roundId)) continue;

            const retry = 0;
            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
            const timestamp = await Settings.getNextCancelRetryTimestamp(settingsFilter, retry);
            const lastWagerDate = await Wager.getLastWagerDate(roundId);

            if (await Settings.hasRetriesExpired(failedAt || lastWagerDate || createdAt, settingsFilter)) continue;

            await scheduleTask("retryCancel", roundId, timestamp, {roundId, retry});
        } catch (e) {
            logger.warn("Couldn't schedule retry cancel task", {roundId, error: e});
        }
    }
}

async function rehydrateRetryDrawWin(): Promise<void> {
    for (const {drawWinId, playerId, drawId, createdAt} of await DrawWin.getByStatus(["unpaid"])) {
        try {
            if (await hasTask("retryDrawWin", drawWinId)) continue;

            const retry = 0;
            const draw = await Draw.findOneByOrFail({drawId});
            const {provider, game} = await Room.getByIdOrFail(draw.roomId);
            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
            if (await Settings.hasRetriesExpired(createdAt, settingsFilter)) continue;

            await scheduleTask("retryDrawWin", drawWinId, await Settings.getNextDepositRetryTimestamp(settingsFilter, retry), {drawWinId, retry});
        } catch (e) {
            logger.warn("Couldn't schedule retry draw win task", {drawWinId, error: e});
        }
    }
}

async function rehydrateRetryCancelCommand(): Promise<void> {
    for (const {roomId, commandId, playerId, createdAt} of await Command.getByStatus(["failed", "finishing"])) {
        try {
            if (await hasTask("retryCancelCommand", commandId)) continue;

            const retry = 0;
            const {provider, game} = await Room.getByIdOrFail(roomId);
            const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(playerId)), provider, game};
            if (await Settings.hasRetriesExpired(createdAt, settingsFilter)) continue;

            await scheduleTask("retryCancelCommand", commandId, await Settings.getNextCancelRetryTimestamp(settingsFilter, retry), {commandId, retry});
        } catch (e) {
            logger.warn("Couldn't schedule retry cancel command task", {commandId, error: e});
        }
    }
}
