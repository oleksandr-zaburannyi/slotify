import {Round} from "../db/model/Round";
import {registerSchedulerCallback, scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
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

export function registerRetryCallbacks(): void {
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
}
