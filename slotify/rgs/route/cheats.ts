import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {gamesService} from "../util/gamesUtil";

export default async function cheats(provider: string, game: string) {
    const cheats = await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/cheats`);
    return {cheats};
}
