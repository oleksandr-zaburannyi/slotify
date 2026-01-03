import {IPlayer} from "../route/authenticate";
import {Room} from "../db/model/Room";
import logger from "@slotify/shared/lib/logger";
import {command, systemCommand} from "./command";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import Exception from "@slotify/shared/lib/Exception";
import {connected, systemConnected} from "./connected";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {cheat} from "./cheat";
import {validateJsonHmac} from "@slotify/shared/lib/middleware/hmac";
import {Settings} from "../db/model/Settings";

export async function onConnected(channel: string, player: IPlayer) {
    const room = await Room.getByIdOrFail(channel);
    const variant = (await Settings.getValues(player)).gameVariant;

    if (!room.enabled) throw new Exception("Room disabled");
    if (room.deletedAt) throw new Exception("Room deleted");
    if (room.currencies && !room.currencies.includes(player.currency)) throw new Exception("Room cannot be entered by player");
    if (room.wallets && !room.wallets.includes(player.wallet)) throw new Exception("Room cannot be entered by player");
    if (room.operators && !room.operators.includes(player.operator)) throw new Exception("Room cannot be entered by player");
    if (room.brands && (!player.brand || !room.brands.includes(player.brand))) throw new Exception("Room cannot be entered by player");
    if (room.variant && variant !== room.variant) throw new Exception("Room cannot be entered by player");

    await connected(room, player.playerId);
}

export async function onMessage(channel: string, player: IPlayer, message: any) {
    switch (message?.type) {
        case "command":
            try {
                const room = await Room.getByIdOrFail(channel);
                const {provider, game, roomId} = room;
                await command(provider, game, roomId, player, message.payload.action, message.payload.bet, message.payload.params);
            } catch (e: any) {
                if (e instanceof Exception) {
                    logger.warn(`Command exception  ${e.code}: ${e.message}`, {
                        playerId: player.playerId,
                        channel,
                        stack: e.stack,
                        errorMessage: message, // renaming message due to logger behaviour
                        status: e.status,
                        data: e.data,
                        name: e.name,
                        payload: e.payload,
                        popups: e.popups,
                    });
                    sendMessage(
                        channel,
                        player.playerId,
                        formatMessage("error", {
                            error: {
                                message: isDevMode() ? message : "Application Error",
                                code: e.code || "APPLICATION_ERROR",
                                payload: e.payload,
                                popups: e.popups,
                            },
                        }),
                    );
                } else {
                    logger.warn(`Command error ${e.message}`, {playerId: player.playerId, channel, error: e});
                }
            }
            break;
        case "cheat":
            try {
                const room = await Room.getByIdOrFail(channel);
                const {provider, game, roomId} = room;
                await cheat(provider, game, player.playerId, roomId, message.payload.cheat, message.payload.params);
            } catch (e) {
                logger.warn("Cheat failed", {message, error: e});
            }
            break;
        default:
            sendMessage(channel, player.playerId, formatMessage("error", {message: "Unknown message type"}));
    }
}

export async function onSystemConnected(channel: string, systemId: string, signature: string) {
    const room = await Room.getByIdOrFail(channel);
    if (!room.enabled) throw new Exception("Room disabled", {data: {room}});
    if (room.deletedAt) throw new Exception("Room deleted", {data: {room}});

    if (!room.secretKey) throw new Exception("Room doesn't support system commands", {data: {room}});
    validateJsonHmac(JSON.stringify({channel, systemId}), signature, room.secretKey);
    await systemConnected(room, systemId);
}

export async function onSystemMessage(channel: string, systemId: string, message: string, signature: string) {
    const messageParsed = JSON.parse(message);
    switch (messageParsed?.type) {
        case "systemCommand":
            try {
                const room = await Room.getByIdOrFail(channel);
                const {provider, game, roomId, secretKey} = room;

                validateJsonHmac(message, signature, secretKey!);
                await systemCommand(provider, game, roomId, systemId, messageParsed.payload.action, messageParsed.payload.params);
            } catch (e: any) {
                if (e instanceof Exception) {
                    logger.warn(`System command exception  ${e.code}: ${e.message}`, {
                        channel,
                        stack: e.stack,
                        errorMessage: message, // renaming message due to logger behaviour
                        status: e.status,
                        data: e.data,
                        name: e.name,
                        payload: e.payload,
                        popups: e.popups,
                    });
                    sendMessage(
                        channel,
                        systemId,
                        formatMessage("error", {
                            error: {
                                message,
                                code: e.code || "APPLICATION_ERROR",
                                payload: e.payload,
                                popups: e.popups,
                            },
                        }),
                    );
                } else {
                    logger.warn(`System command error ${e.message}`, {channel, error: e});
                }
            }
            break;
        default:
            sendMessage(channel, systemId, formatMessage("error", {message: "Unknown message type"}));
    }
}

export function formatMessage(type: "error" | "balance" | "message" | "broadcast", payload: any) {
    return {type, payload};
}

export function sendBroadcast(channel: string, message: any) {
    const body = JSON.stringify({service: "rgs", channel, message});
    fetchAndParse(`${getServiceUrl("websocket")}/api/broadcast`, {method: "POST", body, headers: {"Content-Type": "application/json"}}, 0).catch(e => {
        logger.warn("Failed to send broadcast", {error: e});
    });
}

export function sendMessage(channel: string, playerId: string, message: any) {
    const body = JSON.stringify({service: "rgs", playerId, channel, message});
    fetchAndParse(`${getServiceUrl("websocket")}/api/message`, {method: "POST", body, headers: {"Content-Type": "application/json"}}, 0).catch(e => {
        logger.warn("Failed to send message", {error: e});
    });
}

export async function getConnectionsPerRoom(): Promise<Record<string, number>> {
    const body = JSON.stringify({service: "rgs"});
    return await fetchAndParse(`${getServiceUrl("websocket")}/api/connections`, {method: "POST", body, headers: {"Content-Type": "application/json"}});
}
