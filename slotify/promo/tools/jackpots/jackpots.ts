import logger from "@slotify/shared/lib/logger";
import {IStreamAccumulator, IStreamCampaignState, IStreamSynchronizedAccumulator} from "../../util/streams";
import {IStreamEntry} from "../../db/model/StreamEntry";
import sum from "@slotify/shared/lib/sum";
import {IPlayer, ITransactionRequest} from "../../util/routes";
import {round} from "@slotify/shared/lib/round";
import Exception from "@slotify/shared/lib/Exception";
import {ITool} from "../../util/ITool";
import {floor} from "@slotify/shared/lib/floor";

export const jackpotScheduledAccumulationInterval = 10000;
const baseCurrencyDecimals = 2;

export type IJackpotConfig<TPoolConfig extends {reset: number} = {reset: number}> = {[poolName: string]: TPoolConfig};

export type IPlayerPoolWin = {amount: number; baseCurrencyAmount: number};

export type IJackpotRoundState = {
    currencyRate: number;
    poolsChange?: IJackpotPoolsChange;
    isJackpotWin?: boolean;
    jackpotWin?: number;
    baseCurrencyJackpotWin?: number;
    totalRoundPoolWins?: {[poolName: string]: IPlayerPoolWin};
    depositStatus?: "requested" | "finished";
};

export type IJackpotPlayerState = {
    _rounds: {[roundId: string]: IJackpotRoundState};
    _poolStatistics: {[poolName: string]: IPoolStatistics};
};

export type IJackpotWinData = {
    entryId: number;
    playerId: string;
    roundId: string;
    step?: number;
    transactionId?: string;
    poolWins: {[poolName: string]: number};
};

export type IPoolAmounts = {amount: number; seedAmount: number};
export type IPoolStatistics = {totalContribution: number; totalWin: number; winsCount: number};
export type IJackpotAccumulationData = {
    poolAmounts: {[poolName: string]: IPoolAmounts};
    poolStatistics: {[poolName: string]: IPoolStatistics};
    pendingJackpotWins: {[entryId: number]: IJackpotWinData};
    jackpotWinData?: IJackpotWinData;
};

export type IJackpotPoolChange = {contribution?: number; seedContribution?: number; isJackpotWin?: boolean};
export type IJackpotPoolsChange = {
    [poolName: string]: IJackpotPoolChange;
};

export type IJackpotEntryData = {
    type: "withdrawFinished" | "cancel" | "play" | "modification";
    playerId: string;
    roundId: string;
    step?: number;
    transactionId?: string;
    poolsChange: IJackpotPoolsChange;
};

export type IJackpotLog = {
    playerId: string;
    roundId: string;
    transactionId: string;
    currency: string;
    currencyRate: number;
    jackpotWin: number;
    baseCurrencyJackpotWin: number;
    entry: IStreamEntry<IJackpotEntryData>;
    accumulation: {data: IJackpotAccumulationData; nextAccumulationTime: number};
    playerState: IJackpotPlayerState;
};

export async function calculateBaseCurrencyPoolsChange(playersCurrencyPoolsChange: IJackpotPoolsChange, currencyRate: number) {
    const baseCurrencyPoolsChange: IJackpotPoolsChange = {};

    for (const [poolName, poolChange] of Object.entries(playersCurrencyPoolsChange)) {
        const {contribution, seedContribution, isJackpotWin} = poolChange;

        if (contribution || seedContribution || isJackpotWin) {
            const baseCurrencyContribution = contribution ? contribution / currencyRate : 0;
            const baseCurrencySeedContribution = seedContribution ? seedContribution / currencyRate : 0;

            baseCurrencyPoolsChange[poolName] = {
                contribution: baseCurrencyContribution,
                seedContribution: baseCurrencySeedContribution,
                isJackpotWin,
            };
        }
    }

    return baseCurrencyPoolsChange;
}

export function sumRoundPoolWins(roundState: IJackpotRoundState) {
    return {
        jackpotWin: round(sum(Object.values(roundState.totalRoundPoolWins || {}).map(roundPoolWin => roundPoolWin.amount)), baseCurrencyDecimals),
        baseCurrencyJackpotWin: round(sum(Object.values(roundState.totalRoundPoolWins || {}).map(roundPoolWin => roundPoolWin.baseCurrencyAmount)), baseCurrencyDecimals),
    };
}

export function accumulateJackpotPools(
    config: IJackpotConfig,
    latestAccumulationData: Omit<IJackpotAccumulationData, "type">,
    entries: IStreamEntry<IJackpotEntryData>[],
): {
    poolAmounts: {[poolName: string]: IPoolAmounts};
    pendingJackpotWins: {[entryId: number]: IJackpotWinData};
    poolStatistics: {[poolName: string]: IPoolStatistics};
} {
    const {poolAmounts, pendingJackpotWins, poolStatistics} = latestAccumulationData;

    for (const entry of entries) {
        const entryId = parseInt(entry.id as any);
        const {playerId, roundId, step, transactionId, poolsChange} = entry.data;

        const poolWins: {[poolName: string]: number} = {};
        Object.entries(poolsChange).forEach(([poolName, {contribution, seedContribution, isJackpotWin}]) => {
            if (contribution) {
                poolAmounts[poolName].amount += contribution || 0;
                poolStatistics[poolName].totalContribution += contribution;
            }

            if (seedContribution) {
                poolAmounts[poolName].seedAmount += seedContribution || 0;
                poolStatistics[poolName].totalContribution += seedContribution;
            }

            const poolAmount = poolAmounts[poolName].amount;
            const poolSeedAmount = poolAmounts[poolName].seedAmount;
            if (poolAmount < 0 || poolSeedAmount < 0) {
                logger.warn("Jackpot pool reached negative value due to cancels", {
                    latestAccumulationData,
                    entry,
                    poolAmounts,
                });
            }

            if (isJackpotWin) {
                const winAmount = Math.max(0, floor(poolAmount, baseCurrencyDecimals)); // if pool is negative, pay 0
                poolWins[poolName] = winAmount;
                poolAmounts[poolName].amount = poolAmount - winAmount + config[poolName].reset + poolSeedAmount;
                poolAmounts[poolName].seedAmount = 0;

                poolStatistics[poolName].winsCount++;
                poolStatistics[poolName].totalWin += winAmount;
            }
        });

        if (Object.entries(poolWins).length > 0) {
            pendingJackpotWins[entryId] = {
                entryId,
                playerId,
                roundId,
                step,
                transactionId,
                poolWins,
            };
        }
    }

    Object.entries(poolStatistics).forEach(([poolName, statistics]) => {
        const totalContributed = statistics.totalContribution + (statistics.winsCount + 1) * config[poolName].reset;
        const totalAccrued = poolAmounts[poolName].amount + poolAmounts[poolName].seedAmount + statistics.totalWin;
        const difference = totalContributed - totalAccrued;
        if (Math.abs(difference) > Math.pow(10, -baseCurrencyDecimals)) {
            logger.error(`Jackpot pool ${poolName} contributions and payout are inconsistent by ${difference}`, {
                totalContributed,
                totalAccrued,
                difference,
                statistics,
                amounts: poolAmounts[poolName],
                config: config[poolName],
            });
        }
    });

    return {
        poolAmounts,
        pendingJackpotWins,
        poolStatistics,
    };
}

export function synchronizeJackpotWin(winEntry: IStreamEntry<IJackpotEntryData>): IStreamAccumulator<IJackpotConfig, IJackpotEntryData, IJackpotAccumulationData> {
    return async ({config, entries, latestAccumulationData, time}) => {
        const {poolAmounts, pendingJackpotWins, poolStatistics} = accumulateJackpotPools(config, latestAccumulationData, entries);

        const jackpotWinData = pendingJackpotWins[winEntry.id];
        delete pendingJackpotWins[winEntry.id];

        if (!jackpotWinData) {
            logger.error("Jackpot stream state inconsistent, transactionJackpot win needs to be present in pendingJackpotWins", {
                winEntry,
                latestAccumulationData,
                poolAmounts,
                pendingJackpotWins,
            });
        }

        return {
            data: {
                poolAmounts,
                poolStatistics,
                pendingJackpotWins,
                jackpotWinData,
            },
            nextAccumulationTime: time + jackpotScheduledAccumulationInterval,
        };
    };
}

interface IEvaluateJackpotWinResult {
    playerPoolWins: {[poolName: string]: IPlayerPoolWin};
    jackpotWin: number;
    baseCurrencyJackpotWin: number;
    totalRoundPoolWins: {[poolName: string]: IPlayerPoolWin};
    accumulation: {data: IJackpotAccumulationData; nextAccumulationTime: number};
}
export async function evaluateJackpotWin(
    baseCurrencyPoolsChange: IJackpotPoolsChange,
    entry: IStreamEntry<IJackpotEntryData>,
    streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<IJackpotConfig, IJackpotEntryData, IJackpotAccumulationData>,
    roundState: IJackpotRoundState,
): Promise<IEvaluateJackpotWinResult | undefined> {
    if (Object.values(baseCurrencyPoolsChange).some(poolEntry => poolEntry.isJackpotWin)) {
        const winEntry = entry;
        logger.info("Jackpot win stream synchronization started", {winEntry});
        const accumulation = await streamSynchronizedAccumulator(synchronizeJackpotWin(winEntry));
        logger.info("Jackpot win stream synchronization finished", {winEntry, accumulation});

        const jackpotWinData = accumulation.data.jackpotWinData!;
        const baseCurrencyJackpotWin = sum(Object.values(jackpotWinData.poolWins));
        const jackpotWin = baseCurrencyJackpotWin * roundState.currencyRate;

        const playerPoolWins: {[poolName: string]: IPlayerPoolWin} = {};
        for (const [poolName, amount] of Object.entries(jackpotWinData.poolWins)) {
            playerPoolWins[poolName] = {
                baseCurrencyAmount: amount,
                amount: amount * roundState.currencyRate,
            };
        }

        const totalRoundPoolWins = roundState?.totalRoundPoolWins ?? {};
        Object.entries(playerPoolWins).forEach(([poolName, {amount, baseCurrencyAmount}]) => {
            if (!totalRoundPoolWins[poolName]) {
                totalRoundPoolWins[poolName] = {amount: 0, baseCurrencyAmount: 0};
            }
            totalRoundPoolWins[poolName].amount = totalRoundPoolWins[poolName].amount + amount;
            totalRoundPoolWins[poolName].baseCurrencyAmount = totalRoundPoolWins[poolName].baseCurrencyAmount + baseCurrencyAmount;
        });

        return {
            playerPoolWins,
            jackpotWin,
            baseCurrencyJackpotWin,
            totalRoundPoolWins,
            accumulation,
        };
    }
}

export async function create({config}: {config: IJackpotConfig}): Promise<IJackpotAccumulationData> {
    const poolAmounts: {[poolName: string]: IPoolAmounts} = {};
    const poolStatistics: {[poolName: string]: IPoolStatistics} = {};

    for (const [poolName, poolConfig] of Object.entries(config)) {
        poolAmounts[poolName] = {amount: poolConfig.reset, seedAmount: 0};
        poolStatistics[poolName] = {totalWin: 0, totalContribution: 0, winsCount: 0};
    }
    return {
        poolAmounts,
        poolStatistics,
        pendingJackpotWins: {},
    };
}

export async function accumulator({
    config,
    latestAccumulationData,
    entries,
    time,
}: {
    config: IJackpotConfig;
    entries: IStreamEntry<IJackpotEntryData>[];
    latestAccumulationData: IJackpotAccumulationData;
    time: number;
}): Promise<{data: IJackpotAccumulationData; nextAccumulationTime: number}> {
    const {poolAmounts, pendingJackpotWins, poolStatistics} = accumulateJackpotPools(config, latestAccumulationData, entries);
    return {
        data: {
            poolAmounts,
            pendingJackpotWins,
            poolStatistics,
        },
        nextAccumulationTime: time + jackpotScheduledAccumulationInterval,
    };
}

export async function deposit({player, loadPlayerState, transaction}: {player: IPlayer; transaction: ITransactionRequest; loadPlayerState: any}) {
    if (transaction.category !== "normal") return;

    const playerState: IJackpotPlayerState = await loadPlayerState();
    const roundState = playerState._rounds[transaction.roundId];

    let jackpotAmount;
    if (roundState.totalRoundPoolWins) {
        const roundWins = sumRoundPoolWins(roundState);
        jackpotAmount = roundWins.jackpotWin;
        logger.info("Jackpot deposit requested", {
            playerId: player.playerId,
            roundId: transaction.roundId,
            transactionId: transaction.transactionId,
            playerState,
            currency: player.currency,
            ...roundWins,
        });
    }

    roundState.depositStatus = "requested";

    return {playerState, jackpotAmount};
}

export async function depositFinished({player, transaction, loadPlayerState}: {player: IPlayer; transaction: ITransactionRequest; loadPlayerState: any}) {
    if (transaction.category !== "normal") return;
    const playerState: IJackpotPlayerState = await loadPlayerState();
    const roundState = playerState._rounds[transaction.roundId];

    if (roundState.totalRoundPoolWins) {
        logger.info("Jackpot win deposit finished", {
            playerId: player.playerId,
            roundId: transaction.roundId,
            transactionId: transaction.transactionId,
            playerState,
        });
        Object.entries(roundState.totalRoundPoolWins).forEach(([poolName, roundPoolWin]) => {
            playerState._poolStatistics[poolName].totalWin += roundPoolWin.amount;
            playerState._poolStatistics[poolName].winsCount++;
        });
    }

    delete playerState._rounds[transaction.roundId];

    return {playerState};
}

export async function campaignFeed({config, loadCampaignState}: {config: IJackpotConfig; loadCampaignState: () => Promise<IStreamCampaignState<IJackpotAccumulationData>>}) {
    const {data} = await loadCampaignState();
    return {
        config,
        poolAmounts: Object.fromEntries(Object.entries(data.poolAmounts).map(([poolName, pool]) => [poolName, Math.max(0, floor(pool.amount, baseCurrencyDecimals))])),
    };
}

export const systemEvent: NonNullable<ITool["systemEvent"]> = async ({eventName, params, config, streamEntry}) => {
    if (eventName === "modifyPool") {
        if (!params.poolName) throw new Exception("Pool not specified");
        if (!params.value) throw new Exception("Value not specified");
        if (typeof params.value !== "number") throw new Exception("Value should be a number");
        if (!Object.keys(config).find(poolName => poolName === params.poolName)) throw new Exception("Couldn't find pool to modify");

        const poolsChange: IJackpotPoolsChange = {
            [params.poolName]: {
                contribution: params.value,
            },
        };

        const entry = await streamEntry({
            type: "modification",
            playerId: "admin",
            roundId: "modification",
            poolsChange,
        });

        return {logs: [{name: "modification", data: {entry}}]};
    }
};
