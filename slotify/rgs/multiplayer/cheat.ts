import {isDevMode} from "@slotify/shared/lib/isDevMode";
import {gamesService} from "../util/gamesUtil";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {formatMessage, sendMessage} from "./websocket";
import {isTaskBeingProcessed} from "@slotify/shared/lib/scheduler";
import {Draw} from "../db/model/Draw";
import {retry} from "@slotify/shared/lib/retry";

export async function cheat(provider: string, game: string, playerId: string, roomId: string, cheat: string, params: any) {
    if (!isDevMode()) return;

    try {
        await retry(
            async () => {
                if (await isTaskBeingProcessed("multiplayer", roomId)) return false;

                const draw = await Draw.findOneOrFail({where: {roomId}, order: {id: "DESC"}});
                const request = {cheat, params, state: draw.state};
                const {state} = await fetchAndParse(`${await gamesService(provider, game)}/api/multiplayer/${game}/cheat`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
                if (state) {
                    draw.state = state;
                    await draw.save();
                }
                return true;
            },
            2000,
            () => 100,
        );
    } catch {
        sendMessage(roomId, playerId, formatMessage("error", {message: "Cheat failed"}));
    }
}
