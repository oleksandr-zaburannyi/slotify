import cache from "@slotify/shared/lib/cache";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import logger from "@slotify/shared/lib/logger";
import Exception from "@slotify/shared/lib/Exception";
import {getServiceUrl} from "@slotify/shared/lib/urls";

export const gamesServices = (process.env.GAMES_SERVICES || "").split(",");

export const gamesService = async (provider: string | undefined = process.env.RGS!, game: string) => {
    const games = await getGames();
    if (!games.services[provider]) throw new Exception("Provider doesn't exist", {data: {provider, game, games}});
    if (!games.services[provider][game]) throw new Exception("Game doesn't exist", {data: {provider, game, games}});

    const service = games.services[provider][game];
    return getServiceUrl(service);
};

export function getGamesServiceUrl(service: string) {
    return getServiceUrl(getGamesServiceName(service));
}

function getGamesServiceName(service: string) {
    return "GAMES_" + service.toUpperCase().replace(/-/g, "_");
}

export const getGames = cache(2 * 60, async () => {
    const providers: Record<string, string[]> = {};
    const services: Record<string, Record<string, string>> = {};
    for (const service of gamesServices) {
        try {
            const gamesServiceName = getGamesServiceName(service);
            const url = getGamesServiceUrl(service);
            const games: Record<string, string[]> = await fetchAndParse(`${url}/api/games`, {}, 3);
            const provider = Object.keys(games)[0];

            providers[provider] ||= [];
            providers[provider].push(...games[provider]);

            services[provider] ||= {};
            games[provider].forEach(game => (services[provider][game] = gamesServiceName));
        } catch (e) {
            logger.warn("Couldn't read games from game service", {service, error: e});
        }
    }
    return {providers, services};
});
