import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {URLSearchParams} from "url";
import Exception from "@slotify/shared/lib/Exception";
import {round} from "@slotify/shared/lib/round";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {IPlayer} from "../util/routes";
import {ICampaignSetup, ITool} from "../util/ITool";
import {baseCurrency} from "../util/currencyRates";
import {getServiceUrl} from "@slotify/shared/lib/urls";

type IConfig = {bets: number; amount: number; currency?: string};

type IPlayerState = {
    _rounds: Record<string, "withdraw" | "withdrawFinished">;
    totalWin: number;
    used: number;
    amount: number;
};

async function convertBet(amount: number, currencyFrom: string, currencyTo: string, {provider, game, wallet, operator, brand, jurisdiction}: Partial<IPlayer>): Promise<number> {
    const params = new URLSearchParams(clearEmpty({amount: amount.toString(), currencyFrom, currencyTo, provider, game, wallet, operator, brand, jurisdiction}));
    const {converted} = await fetchAndParse(`${getServiceUrl("rgs")}/api/convertBet?${params.toString()}`);
    return converted;
}

async function getGames(): Promise<Record<string, string[]>> {
    return await fetchAndParse(`${getServiceUrl("rgs")}/games`);
}

async function validate({config, providers, games, playerIds, nativeIds, wallets, operators, brands}: ICampaignSetup<IConfig>) {
    if (!config) throw new Exception("Config must be specified");
    if (typeof config.amount !== "number") throw new Exception("Amount param should be a number");
    if (typeof config.bets !== "number") throw new Exception("Bets param should be a number");
    if (config.amount <= 0) throw new Exception("Amount must be greater then 0");
    if (config.bets <= 0) throw new Exception("Bets must be greater then 0");
    if ((playerIds?.length || 0) + (nativeIds?.length || 0) === 0) throw new Exception("At least one playerId or nativeId must be specified");

    const gamesPerProvider = await getGames();

    providers ||= Object.keys(gamesPerProvider).filter(provider => gamesPerProvider[provider].find(game => !games || games.includes(game)));
    games ||= Object.entries(gamesPerProvider)
        .filter(([provider]) => providers?.includes(provider))
        .map(([, games]) => games)
        .reduce((prev, current) => prev.concat(current), []);

    if (providers.length === 0 || games.length === 0) {
        throw new Exception(`There are no available games or providers to add free bets`, {data: {providers, games}});
    }

    for (const provider of providers) {
        for (const game of games) {
            for (const wallet of wallets || [undefined]) {
                for (const operator of operators || [undefined]) {
                    for (const brand of brands || [undefined]) {
                        const currency = config.currency || baseCurrency;
                        try {
                            await convertBet(config.amount, currency, currency, {provider, game, wallet, operator, brand});
                        } catch {
                            throw new Exception(`Bet ${config.amount} ${currency} not supported on game ${game} from provider ${provider}`, {data: {game, provider, wallet, operator, brand, currency, config}});
                        }
                    }
                }
            }
        }
    }
}

export const freeBets: ITool<IConfig, IPlayerState> = {
    async create(initialCampaignSetup) {
        return await validate(initialCampaignSetup);
    },
    async edit(previousCampaignSetup, previousCampaignState, newCampaignSetup) {
        return await validate(newCampaignSetup);
    },
    async visible({config, player}) {
        try {
            const currency = config.currency || baseCurrency;
            await convertBet(config.amount, currency, player.currency, player);
        } catch {
            return false;
        }
        return true;
    },
    async init({config, player}) {
        const currencyFrom = config.currency || baseCurrency;
        const currencyTo = player.currency;
        const amount = await convertBet(config.amount, currencyFrom, currencyTo, player);
        return {playerState: {used: 0, totalWin: 0, amount, _rounds: {}}};
    },
    async withdraw({config, loadPlayerState, transaction}) {
        if (transaction.category !== "normal") return;

        const playerState = await loadPlayerState();

        if (Object.keys(playerState._rounds).includes(transaction.roundId)) {
            throw new Exception("Free Bets campaign does not support side bets", {data: {transaction}});
        }

        const withdrawsInProgress = Object.values(playerState._rounds).filter(state => state === "withdraw").length;

        if (playerState.used + withdrawsInProgress < config.bets && transaction.amount === playerState.amount) {
            playerState._rounds[transaction.roundId] = "withdraw";
            return {
                free: true,
                playerState,
                campaignData: {
                    total: config.bets,
                    used: playerState.used + 1,
                    amount: playerState.amount,
                    totalWin: playerState.totalWin,
                },
            };
        }
    },
    async withdrawFinished({loadPlayerState, transaction}) {
        if (transaction.category !== "normal") return;

        const playerState = await loadPlayerState();
        if (playerState._rounds[transaction.roundId]) {
            playerState._rounds[transaction.roundId] = "withdrawFinished";
            playerState.used++;
            return {playerState};
        }
    },
    async withdrawFailed({loadPlayerState, transaction}) {
        if (transaction.category !== "normal") return;

        const playerState = await loadPlayerState();
        if (playerState._rounds[transaction.roundId]) {
            delete playerState._rounds[transaction.roundId];
            return {playerState};
        }
    },
    async cancel({loadPlayerState, transaction}) {
        if (transaction.category !== "normal") return;

        const playerState = await loadPlayerState();
        if (playerState._rounds[transaction.roundId]) {
            if (playerState._rounds[transaction.roundId] === "withdrawFinished") {
                playerState.used--;
            }

            delete playerState._rounds[transaction.roundId];
            return {playerState};
        }
    },
    async deposit({loadPlayerState, transaction, config}) {
        if (transaction.category !== "normal") return;

        const playerState = await loadPlayerState();
        if (playerState._rounds[transaction.roundId]) {
            playerState.totalWin = round(playerState.totalWin + transaction.amount, 12);
            delete playerState._rounds[transaction.roundId];
            const finished = playerState.used === config.bets && Object.entries(playerState._rounds).length === 0;
            return {
                playerState,
                finished,
                free: true,
                campaignData: {
                    total: config.bets,
                    used: playerState.used,
                    amount: playerState.amount,
                    totalWin: playerState.totalWin,
                },
            };
        }
    },
    async playerFeed({loadPlayerState, config, params}) {
        if (!params.currency) throw new Exception("Please specify currency");
        if (!params.game) throw new Exception("Please specify game");
        if (!params.provider) throw new Exception("Please specify provider");

        const currency = config.currency || baseCurrency;
        const amount = await convertBet(config.amount, currency, params.currency, {provider: params.provider, game: params.game});
        const {used} = (await loadPlayerState()) || {used: 0};
        const total = config.bets;
        const left = total - used;
        return {total, used, left, amount};
    },
};
