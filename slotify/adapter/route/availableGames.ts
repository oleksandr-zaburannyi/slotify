import {Game} from "../db/model/Game";
import {getSettings} from "../util/external";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";

export async function availableGames(wallet?: string, operator?: string, brand?: string) {
    const games = [];
    for (const {game, title, provider, type, rgs} of await Game.allGames()) {
        if (await Game.verify(game, wallet, operator, brand)) {
            if (rgs !== process.env.DEFAULT_RGS || (await getSettings(clearEmpty({wallet, operator, brand, provider, game}))).gameEnabled === "true") {
                games.push({provider, game, title, type});
            }
        }
    }
    return games;
}
