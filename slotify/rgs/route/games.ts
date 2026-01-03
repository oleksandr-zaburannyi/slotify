import {getGames} from "../util/gamesUtil";

export default async function games() {
    return (await getGames()).providers;
}
