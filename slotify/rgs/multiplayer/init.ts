import {Room} from "../db/model/Room";
import {v4} from "uuid";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {gamesService} from "../util/gamesUtil";
import {Draw} from "../db/model/Draw";

export async function init(room: Room): Promise<Draw> {
    const time = Date.now();
    const {state, nextTickTime} = await initRequest(room, {roomId: room.roomId, config: room.config, time});
    const drawId = v4();
    return await Draw.create({roomId: room.roomId, state, nextTickTime, drawId, finished: false, tickId: 0}).save();
}

async function initRequest(room: Room, request: {time: number; roomId: string; config: any}): Promise<{state?: any; nextTickTime: number; broadcast?: any}> {
    return await fetchAndParse(`${await gamesService(room.provider, room.game)}/api/multiplayer/${room.game}/init`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
}
