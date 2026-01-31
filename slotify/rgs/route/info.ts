import {Wager} from "../db/model/Wager";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {ISettings} from "../db/model/Settings";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {getSessionData, getSessionSettings} from "../util/sessionUtil";
import {getBetLimits, getBets, IBet, IBetLimits} from "../util/betUtil";
import {gamesService} from "../util/gamesUtil";
import {Room} from "../db/model/Room";

async function getGameConfig(provider: string, game: string, variant: string | undefined) {
    return await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/config?variant=${variant || ""}`);
}

export default async function info(
    provider: string,
    game: string,
    playerId: string,
    currency: string,
    wallet: string,
    operator: string,
    brand: string,
    jurisdiction: string,
    sessionId: string | undefined,
    roomId?: string,
): Promise<{state: any; bets: Record<string, IBet>; config: any; variant?: string; settings: ISettings; betLimits: IBetLimits}> {
    const sessionData = sessionId ? await getSessionData(sessionId) : {};
    const settingsFilter = {game, brand, wallet, operator, jurisdiction, provider, currency};
    const settings = await getSessionSettings(settingsFilter, sessionData, false);
    const config = await getGameConfig(provider, game, settings.gameVariant);
    const room = roomId ? await Room.findOneByOrFail({roomId}) : undefined;
    const betLimits = await getBetLimits(currency, settingsFilter, sessionData, room);
    const bets = await getBets(provider, game, settings.gameVariant, currency, wallet, operator, brand, jurisdiction, sessionData, room);
    const state = removeUnderscoredKeys(await Wager.getLatestState(playerId, game));

    const clientSettings = await getSessionSettings(settingsFilter, sessionData, true);

    return {state, bets, config, settings: clientSettings, betLimits};
}
