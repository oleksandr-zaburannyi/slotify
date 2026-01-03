import Exception from "@slotify/shared/lib/Exception";
import {ITool} from "../util/ITool";
import {getCurrencies} from "../util/currencyRates";
import exchangePrizeValue from "../util/exchangePrizeValue";
import validateCampaignPrizes, {IPrizeConfig} from "../util/validateCampaignPrizes";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import sum from "@slotify/shared/lib/sum";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {precisionNumbersMapper} from "../util/precisionNumbersMapper";

type ICampaignConfig = {
    qualifyingBet: number;
    baseBetOnly: boolean;
    prizes: IPrizeConfig[];
};
type ILeaderboard = {
    winRatios: (number | null)[];
    roundIds: (string | null)[];
    games: (string | null)[];
    nicknames: (string | null)[];
};
type ICampaignState = {
    _campaignCurrencyRates: Record<string, number>;
    _exchangedCashValues: Record<string, number[]>;
    leaderboard: ILeaderboard;
    _leaderboardPlayerIds: (string | null)[];
};
type IPlayerState = {
    playerCurrency: string;
    exchangedQualifyingBet: number;
    exchangedCashValues: number[];
    leaderboardRoundId?: string;
};

function validateCommonConfig(config: ICampaignConfig, end: number) {
    if (typeof config.qualifyingBet !== "number") throw new Exception("Qualifying Bet needs to be configured");

    if (typeof config.baseBetOnly !== "boolean") throw new Exception("Base Bet Only flag needs to be configured");

    if (!end) throw new Exception("This campaign requires End date to be set");
}

async function getWinRatio(roundId: string): Promise<number> {
    const {winRatio} = await fetchAndParse(`${getServiceUrl("rgs")}/api/evaluate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({roundId, type: "winRatio"})});
    return winRatio;
}

async function isBaseBet(roundId: string): Promise<number> {
    const {isBaseBet} = await fetchAndParse(`${getServiceUrl("rgs")}/api/evaluate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({roundId, type: "isBaseBet"})});
    return isBaseBet;
}

function playerImprovedTheResult(campaignState: ICampaignState, playerId: string, winRatio: number): boolean {
    const previousPlayerIndex = campaignState._leaderboardPlayerIds.findIndex(id => id === playerId);

    return previousPlayerIndex < 0 || campaignState.leaderboard.winRatios[previousPlayerIndex]! < winRatio;
}

function winRatioQualifiesForLeaderboard(leaderboard: ILeaderboard, winRatio: number): boolean {
    const lowestWinRatio = leaderboard.winRatios[leaderboard.winRatios.length - 1];
    return lowestWinRatio == null || lowestWinRatio < winRatio;
}

function emplacePlayerInLeaderboard(campaignState: ICampaignState, winRatio: number, playerId: string, roundId: string, game?: string, nickname?: string): number {
    const leaderboard = campaignState.leaderboard;
    const leaderboardPlayerIds = campaignState._leaderboardPlayerIds;

    const previousIndex = leaderboardPlayerIds.findIndex(id => id === playerId);
    if (previousIndex >= 0) {
        leaderboard.winRatios.splice(previousIndex, 1);
        leaderboard.roundIds.splice(previousIndex, 1);
        leaderboard.games.splice(previousIndex, 1);
        leaderboard.nicknames.splice(previousIndex, 1);
        leaderboardPlayerIds.splice(previousIndex, 1);
    }

    const indexToEmplace = leaderboard.winRatios.findIndex(leaderboardWinRatio => leaderboardWinRatio! < winRatio);

    leaderboard.winRatios.splice(indexToEmplace, 0, winRatio);
    leaderboard.roundIds.splice(indexToEmplace, 0, roundId);
    leaderboard.games.splice(indexToEmplace, 0, game || null);
    leaderboard.nicknames.splice(indexToEmplace, 0, nickname || null);
    leaderboardPlayerIds.splice(indexToEmplace, 0, playerId);

    if (previousIndex < 0) {
        leaderboard.winRatios.pop();
        leaderboard.roundIds.pop();
        leaderboard.games.pop();
        leaderboard.nicknames.pop();
        leaderboardPlayerIds.pop();
    }

    return indexToEmplace;
}

function getPrizeIndex(prizes: IPrizeConfig[], leaderboardIndex: number): number {
    let index = 0;
    let prizesSum = prizes[0].amount;
    while (index < prizes.length && leaderboardIndex >= prizesSum) {
        index++;
        prizesSum += prizes[index].amount;
    }

    return index;
}

export const tournament: ITool<ICampaignConfig, IPlayerState, ICampaignState> = {
    async create({config, end}) {
        validateCommonConfig(config, end);

        validateCampaignPrizes(config.prizes);

        const currencies = await getCurrencies();
        const _campaignCurrencyRates = Object.fromEntries(currencies.map(item => [item.currency, item.rate]));

        const prizesAmount = sum(config.prizes.map(prize => prize.amount));

        return {
            _campaignCurrencyRates,
            _exchangedCashValues: {},
            leaderboard: {
                winRatios: Array(prizesAmount).fill(null),
                roundIds: Array(prizesAmount).fill(null),
                games: Array(prizesAmount).fill(null),
                nicknames: Array(prizesAmount).fill(null),
            },
            _leaderboardPlayerIds: Array(prizesAmount).fill(null),
        };
    },

    async edit(previousCampaign, previousState, {config, end}) {
        validateCommonConfig(config, end);

        if (JSON.stringify(previousCampaign.config.prizes) !== JSON.stringify(config.prizes)) throw new Exception("Prizes cannot be edited");

        if (previousCampaign.config.qualifyingBet !== config.qualifyingBet) throw new Exception("Qualifying bet cannot be edited");

        return previousState;
    },

    async init({config, player, loadCampaignState}): Promise<any> {
        const campaignState = await loadCampaignState(true);

        const currencyRate = campaignState._campaignCurrencyRates[player.currency];
        const exchangedQualifyingBet = config.qualifyingBet * currencyRate;

        // lazy append exchanged cash values if player with a given currency requests init
        const shouldUpdateExchangedCashValues = campaignState._exchangedCashValues[player.currency] === undefined;
        const exchangedCashValues = shouldUpdateExchangedCashValues ? config.prizes.map(prize => (prize.type === "cash" ? exchangePrizeValue(prize.value as number, currencyRate) : 0)) : campaignState._exchangedCashValues[player.currency];

        campaignState._exchangedCashValues[player.currency] = exchangedCashValues;

        return {
            playerState: {
                exchangedQualifyingBet,
                exchangedCashValues,
            },
            campaignState,
        };
    },

    async depositFinished({config, player, transaction, loadCampaignState, loadPlayerState}): Promise<any> {
        if (!transaction.roundFinished || transaction.amount <= 0) {
            return;
        }

        if (config.baseBetOnly && !(await isBaseBet(transaction.roundId))) {
            return;
        }

        const winRatio = await getWinRatio(transaction.roundId);
        const mainBet = precisionNumbersMapper(transaction.amount / winRatio, 8);

        const playerState = await loadPlayerState();
        if (mainBet < playerState.exchangedQualifyingBet) {
            return;
        }

        const campaignState = await loadCampaignState();

        if (playerImprovedTheResult(campaignState, player.playerId, winRatio) && winRatioQualifiesForLeaderboard(campaignState.leaderboard, winRatio)) {
            emplacePlayerInLeaderboard(campaignState, winRatio, player.playerId, transaction.roundId, transaction.game, player.nickname);

            return {
                campaignState,
                playerState: {
                    ...playerState,
                    leaderboardRoundId: transaction.roundId,
                },
            };
        }
    },

    async acknowledge({config, player, loadCampaignState}): Promise<any> {
        const campaignState = await loadCampaignState(true);

        const leaderboardIndex = campaignState._leaderboardPlayerIds.findIndex(playerId => playerId === player.playerId);

        if (leaderboardIndex >= 0) {
            const prizeIndex = getPrizeIndex(config.prizes, leaderboardIndex);
            const prizeConfig = config.prizes[prizeIndex];
            const exchangedCashValue = campaignState._exchangedCashValues[player.currency][prizeIndex];

            return {
                prizes: [
                    {
                        playerId: player.playerId,
                        type: prizeConfig.type,
                        data: prizeConfig.type === "cash" ? {amount: exchangedCashValue, currency: player.currency} : {name: prizeConfig.value},
                    },
                ],
            };
        }
    },
    async campaignFeed({config, start, end, loadCampaignState}): Promise<any> {
        const state = await loadCampaignState();
        const currency = process.env.BASE_CURRENCY;
        const prizeValuesAtPositions = config.prizes.flatMap((prize: any) =>
            Array(prize.amount).fill(prize.type === "cash" ? prize.value.toLocaleString("en-US", {style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2}) : prize.value),
        );
        const leaderboard = state.leaderboard.winRatios.map((winRatio, i) => {
            return {position: i + 1, winRatio, nickname: state.leaderboard.nicknames[i], prize: prizeValuesAtPositions[i], roundId: state.leaderboard.roundIds[i]};
        });
        return {config, leaderboard, start, end};
    },
};
