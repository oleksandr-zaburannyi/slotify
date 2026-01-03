import {Room} from "../db/model/Room";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {formatMessage, sendMessage} from "./websocket";
import {gamesService} from "../util/gamesUtil";
import {Draw} from "../db/model/Draw";
import logger from "@slotify/shared/lib/logger";

export async function connected(room: Room, playerId: string): Promise<void> {
    logger.info(`Multiplayer connected request from player ${playerId}`, {playerId, room});

    const draw = await Draw.findOneOrFail({where: {roomId: room.roomId}, order: {id: "DESC"}});
    const {message} = await connectedRequest(room, {state: draw.state, time: Date.now(), playerId});

    if (message) {
        sendMessage(room.roomId, playerId, formatMessage("message", message));
    }
}

export async function systemConnected(room: Room, systemId: string): Promise<void> {
    logger.info(`Multiplayer connected request from system ${systemId}`, {systemId, room});

    const draw = await Draw.findOneOrFail({where: {roomId: room.roomId}, order: {id: "DESC"}});

    const {message} = await systemConnectedRequest(room, {state: draw.state, time: Date.now(), systemId});

    if (message) {
        sendMessage(room.roomId, systemId, formatMessage("message", message));
    }
}

async function connectedRequest(room: Room, request: {state: any; time: number; playerId: string}): Promise<{message?: any}> {
    return await fetchAndParse(`${await gamesService(room.provider, room.game)}/api/multiplayer/${room.game}/connected`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
}

async function systemConnectedRequest(room: Room, request: {state: any; time: number; systemId: string}): Promise<{message?: any}> {
    return await fetchAndParse(`${await gamesService(room.provider, room.game)}/api/multiplayer/${room.game}/systemConnected`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
}
