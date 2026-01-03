import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {IPlayer} from "../route/authenticate";
import {cancelWithdrawRequest, formatCommandRgsTransactionId, getPlayerDetails, shouldCancelOnWithdrawError, shouldIgnoreCancelError, transactionRequest} from "../util/adapterUtil";
import {Command} from "../db/model/Command";
import {v4} from "uuid";
import {getBetLimits, getBets, IBetLimits} from "../util/betUtil";
import {validateInitialPlay} from "../route/play";
import {formatMessage, sendMessage} from "./websocket";
import logger from "@slotify/shared/lib/logger";
import {getSessionData} from "../util/sessionUtil";
import {gamesService} from "../util/gamesUtil";
import {scheduleInstant, scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {Draw} from "../db/model/Draw";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {Room} from "../db/model/Room";
import {Currency} from "../db/model/Currency";
import {SystemCommand} from "../db/model/SystemCommand";

export async function command(provider: string, game: string, roomId: string, player: IPlayer, action: string, bet?: number, params?: any) {
    logger.info(`Multiplayer command request from player ${player.playerId}`, {playerId: player.playerId, game, roomId, action, bet, params});

    const {operator, brand, currency, playerId, wallet, jurisdiction, sessionId, nickname} = player;
    const settingsFilter = {game, brand, jurisdiction, wallet, provider, operator, currency};
    const sessionData = await getSessionData(sessionId);

    const hasBet = bet !== undefined;
    if (hasBet) {
        const {decimals} = await Currency.getFixedRate(currency, settingsFilter);
        const bets = await getBets(provider, game, undefined, currency, wallet, operator, brand, jurisdiction, sessionData, roomId);
        validateInitialPlay(bet, decimals, bets, action);
    }
    const betLimits = await getBetLimits(player.currency, settingsFilter, sessionData);

    const draw = await Draw.findOneOrFail({where: {roomId}, order: {id: "DESC"}});

    const time = Date.now();

    const {valid, instantTick, message, roundId} = await commandRequest(provider, game, playerId, betLimits, time, draw.state, action, bet, currency, params);

    const drawId = draw.getNextDrawId();

    if (message) {
        sendMessage(roomId, playerId, formatMessage("message", message));
    }

    if (valid) {
        try {
            const command: Command = await createCommand(hasBet, roomId, playerId, drawId, roundId, time, action, currency, params, bet, {nickname, betLimits});

            if (hasBet) {
                const {balance, popups} = await withdraw(provider, game, command!);
                sendMessage(roomId, playerId, formatMessage("balance", {balance, popups}));
            }
        } catch (e) {
            if (e instanceof Exception) {
                sendMessage(roomId, playerId, formatMessage("error", {code: e.code, status: e.status, popups: e.popups, payload: e.payload}));
            }
            throw e;
        }

        if (instantTick) {
            await scheduleInstant("multiplayer", roomId);
        }
    } else {
        throw new Exception("Command rejected", {code: "COMMAND_REJECTED"});
    }
}

export async function systemCommand(provider: string, game: string, roomId: string, systemId: string, action: string, params?: any) {
    logger.info(`Multiplayer system command request from player ${systemId}`, {playerId: systemId, game, roomId, action, params});

    const draw = await Draw.findOneOrFail({where: {roomId}, order: {id: "DESC"}});

    const time = Date.now();

    const {valid, instantTick, message} = await systemCommandRequest(provider, game, systemId, time, draw.state, action, params);

    const drawId = draw.getNextDrawId();

    if (message) {
        sendMessage(roomId, systemId, formatMessage("message", message));
    }

    if (valid) {
        try {
            await createSystemCommand(roomId, systemId, drawId, time, action, params, undefined);
        } catch (e) {
            if (e instanceof Exception) {
                sendMessage(roomId, systemId, formatMessage("error", {code: e.code, status: e.status, popups: e.popups, payload: e.payload}));
            }
            throw e;
        }

        if (instantTick) {
            await scheduleInstant("multiplayer", roomId);
        }
    } else {
        throw new Exception("System command rejected", {code: "SYSTEM_COMMAND_REJECTED"});
    }
}

async function createCommand(
    hasBet: boolean,
    roomId: string,
    playerId: string,
    drawId: string,
    roundId: string | undefined,
    time: number,
    action: string,
    currency: string | undefined,
    params: any,
    bet: number | undefined,
    data: any | undefined,
) {
    let command: Command;

    roundId = roundId || v4(); // assign roundId if game didn't link the command to any existing

    await getConnection("primary").transaction(async manager => {
        if (hasBet && (await manager.findOneBy(Command, {roundId, withdrawalStatus: "finishing"}))) {
            throw new Exception("Another withdrawal is still in progress");
        }
        command = await manager.save(
            Command,
            Command.create({
                commandId: v4(),
                roundId,
                roomId,
                playerId,
                drawId,
                time,
                action,
                bet,
                currency: hasBet ? currency : undefined,
                params,
                withdrawalStatus: hasBet ? "finishing" : undefined,
                data,
            }),
        );
    });
    return command!;
}

async function createSystemCommand(roomId: string, systemId: string, drawId: string, time: number, action: string, params: any, data: any | undefined) {
    let systemCommand: SystemCommand;

    await getConnection("primary").transaction(async manager => {
        systemCommand = await manager.save(
            SystemCommand,
            SystemCommand.create({
                commandId: v4(),
                roomId,
                systemId,
                drawId,
                time,
                action,
                params,
                data,
            }),
        );
    });
    return systemCommand!;
}

export async function commandRequest(
    provider: string | undefined,
    game: string,
    playerId: string,
    betLimits: IBetLimits,
    time: number,
    state?: any,
    action?: string,
    bet?: number,
    currency?: string,
    params?: any,
    data?: any,
): Promise<{valid: boolean; instantTick: boolean; message: any; roundId?: string}> {
    const request = {playerId, time, action, bet, currency, params, state, betLimits, data};
    return await fetchAndParse(`${await gamesService(provider, game)}/api/multiplayer/${game}/command`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
}

export async function systemCommandRequest(
    provider: string | undefined,
    game: string,
    systemId: string,
    time: number,
    state?: any,
    action?: string,
    params?: any,
): Promise<{valid: boolean; instantTick: boolean; message: any; roundId?: string}> {
    const request = {systemId, time, action, params, state};
    return await fetchAndParse(`${await gamesService(provider, game)}/api/multiplayer/${game}/systemCommand`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
}

async function withdraw(provider: string, game: string, command: Command): Promise<{balance: number; popups?: IExceptionPopup[]}> {
    const rgsTransactionId = formatCommandRgsTransactionId(command.commandId);
    try {
        const room = await Room.findOneByOrFail({roomId: command.roomId});
        const res = await transactionRequest(rgsTransactionId, command.playerId, {type: "withdraw", category: "normal", provider, game, amount: command.bet!, roundFinished: false, roundId: command.roundId, variant: room.variant}, false);
        await Command.update({id: command.id}, {withdrawalStatus: "finished"});
        return res;
    } catch (e) {
        if (shouldCancelOnWithdrawError(e)) {
            await Command.update({id: command.id}, {withdrawalStatus: "failed", processed: false});
            await cancelCommand(command.commandId, false, 0);
        } else {
            await Command.update({id: command.id}, {withdrawalStatus: "cancelled", processed: false});
        }
        throw e;
    }
}

export async function cancelCommand(commandId: string, auto: boolean = false, retry: number | null) {
    try {
        const rgsTransactionId = formatCommandRgsTransactionId(commandId);
        const balance = await cancelWithdrawRequest(rgsTransactionId, auto);
        await unsheduleTask("retryCancelCommand", commandId);
        await Command.update({commandId}, {withdrawalStatus: "cancelled"});
        return balance;
    } catch (e) {
        if (shouldIgnoreCancelError(e)) {
            await unsheduleTask("retryCancelCommand", commandId);
            await Command.update({commandId}, {withdrawalStatus: "cancelled"});
        } else {
            if (retry != null) {
                const command = await Command.findOneByOrFail({commandId});
                const {provider, game} = await Room.getByIdOrFail(command.roomId);
                const settingsFilter: ISettingsFilter = {...(await getPlayerDetails(command.playerId)), provider, game};
                await scheduleTask("retryCancelCommand", commandId, await Settings.getNextCancelRetryTimestamp(settingsFilter, retry), {commandId, retry});
            }
            logger.warn("Failed to cancel command withdrawal", {commandId, error: e});
        }
    }
}
