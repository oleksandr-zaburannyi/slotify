import Exception from "@slotify/shared/lib/Exception";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {ICampaignSetup, IStreamTool} from "../util/ITool";
import {getCurrencyRate} from "../util/currencyRates";
import {IPlayer, ITransactionRequest} from "../util/routes";

type IConfig = {positions: number};
type IEntryData = {position: IPosition; game: string};
type IAccumulationData = {leaderboards: Record<string, ILeaderboardTypes>};
type IPlayerState = Record<string, ILeaderboardTypes>;
type IPosition = {timestamp: number; playerId: string; win: number; bet: number; currencyRate: number; winRatio: number; roundId: string; nickname?: string; currency: string};
type ILeaderboardPeriods = {all: IPosition[]; yearly: IPosition[]; monthly: IPosition[]; daily: IPosition[]};
type ILeaderboardTypes = {winAmount: ILeaderboardPeriods; winRatio: ILeaderboardPeriods};

export const rgsService = `http://${process.env.RGS_SERVICE_HOST}:${process.env.RGS_SERVICE_PORT}`;

const getWinRatio = async (roundId: string): Promise<{winRatio: number; bet: number; win: number}> => {
    const {winRatio, bet, win} = await fetchAndParse(`${rgsService}/api/evaluate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({roundId, type: "winRatio"})});
    return {winRatio, bet, win};
};

const periodEvaluators: Record<keyof ILeaderboardPeriods, (time: Date) => boolean> = {
    "all": () => true,
    "yearly": (date: Date) => new Date().getFullYear() === date.getFullYear(),
    "monthly": (date: Date) => new Date().getFullYear() === date.getFullYear() && new Date().getMonth() === date.getMonth(),
    "daily": (date: Date) => new Date().getFullYear() === date.getFullYear() && new Date().getMonth() === date.getMonth() && new Date().getDate() === date.getDate(),
};

const sortValueExtractor: Record<keyof ILeaderboardTypes, (position: IPosition) => number> = {
    "winAmount": position => position.win / position.currencyRate,
    "winRatio": position => position.winRatio,
};

function getDefaultGameLeaderboard() {
    return {winRatio: {all: [], yearly: [], monthly: [], daily: []}, winAmount: {all: [], yearly: [], monthly: [], daily: []}};
}

function updateLeaderboards(leaderboards: Record<string, ILeaderboardTypes> = {}, types: (keyof ILeaderboardTypes)[], game: string, position: IPosition, config: IConfig): boolean {
    leaderboards[game] ||= getDefaultGameLeaderboard();
    const gameLeaderboard = leaderboards[game];

    let changed = false;
    for (const type of types) {
        for (const period of Object.keys(gameLeaderboard[type]) as (keyof ILeaderboardPeriods)[]) {
            if (!periodEvaluators[period](new Date(position.timestamp))) continue;

            const leaderboard: IPosition[] = gameLeaderboard[type][period].filter(({timestamp}) => periodEvaluators[period](new Date(timestamp)));

            if (leaderboard.length < config.positions || sortValueExtractor[type](position) > sortValueExtractor[type](leaderboard[leaderboard.length - 1])) {
                leaderboard.push(position);
                leaderboard.sort((a, b) => sortValueExtractor[type](b) - sortValueExtractor[type](a));
                while (leaderboard.length > config.positions) leaderboard.pop();
                gameLeaderboard[type][period] = leaderboard;
                changed = true;
            }
        }
    }

    return changed;
}

async function validate({config, games}: ICampaignSetup<IConfig>) {
    if (!games) throw new Exception("Leaderboard requires setting it specific games");
    if (isNaN(config.positions)) throw new Exception("Positions param should be a number");
    if (config.positions <= 0) throw new Exception("Positions must be greater then 0");
    if (games.length * config.positions > 200) throw new Exception("Total amount of positions stored in campaign state cannot exceed 200");
}

async function createNewPosition(player: IPlayer, transaction: ITransactionRequest): Promise<IPosition> {
    const {win, bet, winRatio} = await getWinRatio(transaction.roundId);
    const {currency, playerId, nickname} = player;
    const currencyRate = await getCurrencyRate(player.currency);
    return {timestamp: Date.now(), currency, playerId, nickname, win, bet, winRatio, currencyRate, roundId: transaction.roundId};
}

export const leaderboard: IStreamTool<IConfig, IPlayerState, undefined, IEntryData, IAccumulationData> = {
    autoOptIn: true,

    async create(campaignSetup) {
        await validate(campaignSetup);
        return {leaderboards: {}};
    },

    async edit(previousCampaignSetup, previousCampaignState, newCampaignSetup) {
        await validate(newCampaignSetup);
        if (newCampaignSetup.config.positions !== previousCampaignSetup.config.positions) throw new Exception("Positions amount cannot be edited");
    },

    async accumulator({config, latestAccumulationData, entries, time}) {
        const campaignLeaderboardTypes: (keyof ILeaderboardTypes)[] = ["winAmount", "winRatio"];

        const {leaderboards} = latestAccumulationData;

        entries.forEach(({data: {position, game}}) => {
            updateLeaderboards(leaderboards, campaignLeaderboardTypes, game, position, config);
        });

        return {
            data: {leaderboards},
            nextAccumulationTime: time + 5000,
        };
    },

    async deposit({transaction, loadPlayerState, player, config, streamEntry}) {
        if (transaction.amount === 0 || !transaction.game) return;

        const position = await createNewPosition(player, transaction);
        const game = transaction.game;

        await streamEntry({position, game});

        const playerLeaderboardTypes: (keyof ILeaderboardTypes)[] = ["winRatio"];

        const playerLeaderboards = (await loadPlayerState(true)) || {};
        const changed = updateLeaderboards(playerLeaderboards, playerLeaderboardTypes, game, position, config);
        if (changed) {
            return {
                playerState: playerLeaderboards,
            };
        }
    },

    async campaignFeed({params, loadCampaignState}) {
        if (!params.game) throw new Exception("Game param should be passed");

        const {data} = await loadCampaignState();
        const {leaderboards} = data;

        for (const game of Object.keys(leaderboards)) {
            for (const type of Object.keys(leaderboards[game]) as (keyof ILeaderboardTypes)[]) {
                for (const period of Object.keys(leaderboards[game][type]) as (keyof ILeaderboardPeriods)[]) {
                    leaderboards[game][type][period] = leaderboards[game][type][period].filter(({timestamp}) => periodEvaluators[period](new Date(timestamp)));
                }
            }
        }

        return {[params.game]: leaderboards[params.game] || getDefaultGameLeaderboard()};
    },
};
