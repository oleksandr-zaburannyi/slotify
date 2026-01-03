import Exception from "@slotify/shared/lib/Exception";
import {IGame} from "./IGame";
import * as glob from "glob";
import {IMultiplayerGame} from "./IMultiplayerGame";

export function getGame(game: string): IGame | IMultiplayerGame {
    if (!game) throw new Exception("Game not specified");
    if (!games[game]) throw new Exception(`Couldn't find game '${game}'`);
    return games[game];
}

let games: {[key: string]: IGame};

export function getGames(): string[] {
    return Object.keys(games);
}

export async function initGames() {
    games = {};
    for (const gamePath of glob.sync(process.env.GAMES_PATH!)) {
        const game = await import(process.cwd() + "/" + gamePath);

        const names: string[] = typeof game.default.name === "string" ? [game.default.name] : game.default.name;
        names.forEach(name => {
            if (games[name]) {
                throw new Exception(`Game '${name}' already exists`);
            }
            games[name] = game.default;
        });
    }
}
