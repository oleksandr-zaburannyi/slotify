import {Room} from "../db/model/Room";
import {Command} from "../db/model/Command";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {formatDrawWinRgsTransactionId, getPlayerDetails, shouldIgnoreDepositError, transactionRequest} from "../util/adapterUtil";
import logger from "@slotify/shared/lib/logger";
import {DrawWin} from "../db/model/DrawWin";
import {Equal, In, IsNull, Not, Or} from "typeorm";
import {formatMessage, sendBroadcast, sendMessage} from "./websocket";
import {init} from "./init";
import {cancelCommand} from "./command";
import {redisPubSub} from "@slotify/shared/lib/redis";
import {gamesService} from "../util/gamesUtil";
import {hasTask, registerSchedulerCallback, scheduleTask, setTaskTimestamp, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {Draw} from "../db/model/Draw";
import {calculateFinalWin, winRatio} from "../util/roundUtil";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {DrawRngState, getDrawRngState, updateRngHashCursor} from "../util/provablyFairMultiplayerUtil";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {SystemCommand} from "../db/model/SystemCommand";

registerSchedulerCallback("multiplayer", tick, {parallelTasksLimit: 1000});

export async function initTicks() {
    await redisPubSub.subscribe("roomAdded", async () => await initTicksForRooms());
    await initTicksForRooms();
}

async function initTicksForRooms() {
    const rooms = await Room.find({withDeleted: true});
    for (const room of rooms) {
        if (room.deletedAt || (room.provablyFair && !room.provablyFair.seed)) {
            continue;
        }

        const {roomId} = room;
        if (!(await hasTask("multiplayer", roomId))) {
            try {
                const draw = (await Draw.findOne({where: {roomId}, order: {id: "DESC"}})) || (await init(room));
                await scheduleTask("multiplayer", roomId, draw.nextTickTime, {roomId});
            } catch (e) {
                logger.warn("Couldn't schedule the tick", {error: e});
            }
        }
    }
}

async function tick({roomId}: any): Promise<number | void> {
    const time = Date.now();

    const room = await Room.getByIdOrFail(roomId);
    if (room.deletedAt) {
        await unsheduleTask("multiplayer", roomId);
        return;
    }
    let draw = await Draw.findOneOrFail({where: {roomId}, order: {id: "DESC"}});
    const drawId = draw.getNextDrawId();

    if (Math.abs(time - draw.nextTickTime) > 300) {
        logger.warn(`Tick execution time was delayed by ${time - draw.nextTickTime}`, {
            roomId,
            drawId,
            time,
            nextTickTime: draw.nextTickTime,
        });
    }

    const commands = await Command.find({
        where: {roomId, processed: IsNull(), withdrawalStatus: Or(IsNull(), Equal("finished"))},
        order: {id: "ASC"},
    });

    const currentRoundCommands = commands.filter(command => command.drawId === drawId);
    const outdatedRoundCommands = commands.filter(command => command.drawId !== drawId);

    const systemCommands = await SystemCommand.find({
        where: {roomId, processed: IsNull()},
        order: {id: "ASC"},
    });

    const currentRoundSystemCommands = systemCommands.filter(command => command.drawId === drawId);
    const outdatedRoundSystemCommands = systemCommands.filter(command => command.drawId !== drawId);

    const rngState = room.provablyFair ? await getDrawRngState(room.roomId, drawId) : undefined;

    const {state, cancels, nextTickTime, wins, broadcast, messages, drawFinished, rngPayload} = await tickRequest(room, time, draw.state, currentRoundCommands, currentRoundSystemCommands, drawId, rngState);

    if (draw.finished) {
        draw = Draw.create({roomId: room.roomId, drawId, tickId: 0});
    }

    draw.tickId++;
    draw.state = state;
    draw.nextTickTime = nextTickTime;
    draw.finished = !!drawFinished;
    await draw.save();

    if (room.provablyFair && rngPayload?.newRngCursor) {
        await updateRngHashCursor(drawId, rngPayload.newRngCursor, rngState!);
    }

    if (currentRoundCommands.length > 0) await Command.update({commandId: In(currentRoundCommands.map(command => command.commandId))}, {tickId: draw.tickId, processed: true});
    if (outdatedRoundCommands.length > 0) await Command.update({commandId: In(outdatedRoundCommands.map(command => command.commandId))}, {processed: true});

    if (currentRoundSystemCommands.length > 0) await SystemCommand.update({commandId: In(currentRoundSystemCommands.map(command => command.commandId))}, {tickId: draw.tickId, processed: true});
    if (outdatedRoundSystemCommands.length > 0) await SystemCommand.update({commandId: In(outdatedRoundSystemCommands.map(command => command.commandId))}, {processed: true});

    const commandsToCancel = [...(cancels || []), ...outdatedRoundCommands.map(command => command.commandId)];
    if (commandsToCancel.length > 0) {
        await Command.update({commandId: In(commandsToCancel), withdrawalStatus: "finished"}, {withdrawalStatus: "failed"});
        // silencing the error due to cancelCommandWithdrawals already logging the error
        cancelCommandWithdrawals(room, commandsToCancel).catch(() => null);
    }

    await payWins(room, draw, wins);

    if (drawFinished) {
        const zeroWins = await getZeroWins(draw.drawId);
        await payWins(room, draw, zeroWins);
    }

    if (broadcast) {
        sendBroadcast(roomId, formatMessage("broadcast", broadcast));
    }

    if (messages) {
        Object.entries(messages).forEach(([playerId, message]) => sendMessage(roomId, playerId, formatMessage("message", message)));
    }

    await setTaskTimestamp("multiplayer", roomId, draw.nextTickTime);

    const finishedTime = Date.now();
    if (Math.abs(finishedTime - time) > 200) {
        logger.warn(`Long tick execution time ${finishedTime - time}`, {
            roomId,
            drawId,
            time,
            finishedTime,
            nextTickTime: draw.nextTickTime,
            commandsCount: commands.length,
            commandsToCancelCount: commandsToCancel.length,
            winsCount: Object.entries(wins || {}).length,
        });
    }
}

async function tickRequest(
    room: Room,
    time: number,
    state: any,
    commands: Command[],
    systemCommands: SystemCommand[],
    drawId: string,
    rngState?: DrawRngState,
): Promise<{state?: any; cancels?: string[]; nextTickTime: number; wins?: {[key: string]: number}; broadcast: any; messages?: {[playerId: string]: any}; drawFinished?: boolean; rngPayload?: {newRngCursor: number}}> {
    const request = {
        time,
        state,
        commands: commands.map(command => ({
            commandId: command.commandId,
            playerId: command.playerId,
            roundId: command.roundId,
            time: command.time,
            action: command.action,
            bet: command.bet,
            currency: command.currency,
            params: command.params,
            data: command.data,
        })),
        systemCommands: systemCommands.map(command => ({
            systemId: command.systemId,
            commandId: command.commandId,
            time: command.time,
            action: command.action,
            params: command.params,
            data: command.data,
        })),
        drawId,
        rngState,
    };

    return await fetchAndParse(`${await gamesService(room.provider, room.game)}/api/multiplayer/${room.game}/tick`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
}

async function cancelCommandWithdrawals(room: Room, commandIdsToCancel: string[]) {
    for (const commandId of commandIdsToCancel || []) {
        const commandToCancel = await Command.findOneBy({commandId});
        if (commandToCancel?.withdrawalStatus === "failed") {
            const balance = await cancelCommand(commandId, false, 0);
            sendMessage(room.roomId, commandToCancel.playerId, formatMessage("balance", {balance}));
        } else {
            if (commandToCancel?.withdrawalStatus != null) {
                logger.error("Attempting to cancel command withdrawal that was not marked as failed", {commandToCancel});
            }
        }
    }
}

async function getZeroWins(drawId: string): Promise<{[roundId: number]: number}> {
    //pay zero wins to all the players which made deposits but didn't get any wins during a multiplayer round
    const drawWins: {roundId: string}[] = await DrawWin.find({select: ["roundId"], where: {drawId}});
    const roundsWithWins = drawWins.map(drawWin => drawWin.roundId);
    const commands: {roundId: string}[] = await Command.find({
        select: ["roundId"],
        where: {drawId, bet: Not(IsNull()), tickId: Not(IsNull()), withdrawalStatus: "finished", roundId: Not(In(roundsWithWins))},
    });

    const wins: {[roundId: string]: number} = {};
    commands.forEach(({roundId}) => {
        wins[roundId] = 0;
    });

    return wins;
}

async function payWins(room: Room, draw: Draw, wins?: {[roundId: string]: number}) {
    const drawWinsData = [];
    for (const [roundId, amount] of Object.entries(wins || {})) {
        const {playerId} = await Command.findOneOrFail({
            where: {roundId, withdrawalStatus: "finished", bet: Not(IsNull())},
            order: {id: "ASC"},
            select: ["playerId"],
        });

        drawWinsData.push({playerId, amount, tickId: draw.tickId, status: "finishing" as const, roundId, drawId: draw.drawId});
    }

    const drawWins = await DrawWin.save(drawWinsData);

    for (const drawWin of drawWins) {
        payDrawWin(drawWin, room, 0)
            .then(({balance, finalWin, popups}) => {
                sendMessage(room.roomId, drawWin.playerId, formatMessage("balance", {balance, finalWin, popups}));
            })
            .catch(e => logger.warn("Error while paying multiplayer win", e));
    }
}

export async function payDrawWin(drawWin: DrawWin, {provider, game, variant}: Room, retry: number | null) {
    const rgsTransactionId = formatDrawWinRgsTransactionId(drawWin.drawWinId);
    const drawWinId = drawWin.drawWinId;

    try {
        const command = await Command.findOneOrFail({where: {roundId: drawWin.roundId, withdrawalStatus: "finished", bet: Not(IsNull())}, order: {id: "ASC"}});

        const {wallet, operator, brand, currency, jurisdiction} = await fetchAndParse(`${getServiceUrl("adapter")}/api/players/${drawWin.playerId}`);

        const finalWin = await calculateFinalWin(drawWin.amount, {wallet, operator, brand, currency, jurisdiction, game, provider});

        const {balance, popups, promo} = await transactionRequest(
            rgsTransactionId,
            drawWin.playerId,
            {
                type: "deposit",
                category: "normal",
                provider,
                game,
                variant,
                amount: finalWin,
                roundFinished: true,
                roundId: drawWin.roundId,
                winRatio: await winRatio(provider, game, undefined, command.action, command.bet!, drawWin.amount),
            },
            false,
        );

        await unsheduleTask("retryDrawWin", drawWinId);
        await DrawWin.update({drawWinId}, {status: "finished"});
        return {balance, finalWin, popups, promo};
    } catch (e) {
        if (shouldIgnoreDepositError(e)) {
            await unsheduleTask("retryDrawWin", drawWinId);
            await DrawWin.update({drawWinId}, {status: "finished"});
        } else {
            if (retry != null) {
                const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(drawWin.playerId)), provider, game};
                await scheduleTask("retryDrawWin", drawWinId, await Settings.getNextDepositRetryTimestamp(settingsFilter, retry), {drawWinId, retry});
            }
            await DrawWin.update({drawWinId}, {status: "unpaid"});
        }
        throw e;
    }
}
