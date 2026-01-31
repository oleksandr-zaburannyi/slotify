import logger from "@slotify/shared/lib/logger";
import {IStreamAccumulator, IStreamCampaignState, IStreamSynchronizedAccumulator} from "../../util/streams";
import {IStreamEntry} from "../../db/model/StreamEntry";
import sum from "@slotify/shared/lib/sum";
import {IPlayer, ITransactionRequest} from "../../util/routes";
import {round} from "@slotify/shared/lib/round";
import Exception from "@slotify/shared/lib/Exception";
import {floor} from "@slotify/shared/lib/floor";
import {getCurrencyRate} from "../../util/currencyRates";
import {ITool} from "../../util/ITool";

export const jackpotScheduledAccumulationInterval = 10000;
const baseCurrencyDecimals = 2;

export type IJackpotConfig<TPoolConfig extends {reset: number} = {reset: number}> = {
    poolsConfig: {[poolName: string]: TPoolConfig};
    baseCurrency: string;
};

export type IPlayerPoolWin = {amount: number; baseCurrencyAmount: number; time: number};

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
    _roundJackpotsWon: {roundId: string; totalRoundPoolWins: {[poolName: string]: IPlayerPoolWin}}[];
};

export type IJackpotWinData = {
    entryId: number;
    playerId: string;
    roundId: string;
    step?: number;
    transactionId?: string;
    poolWins: {[poolName: string]: number};
    time: number;
};

export type IPoolAmounts = {amount: number; seedAmount: number};
export type IPoolStatistics = {totalContribution: number; totalWin: number; winsCount: number};
export type IJackpotAccumulationData = {
    _poolAmounts: {[poolName: string]: IPoolAmounts};
    _poolStatistics: {[poolName: string]: IPoolStatistics};
    _pendingJackpotWins: {[entryId: number]: IJackpotWinData};
    _jackpotWinData?: IJackpotWinData;
};

export type IJackpotPoolChange = {contribution?: number; seedContribution?: number; isJackpotWin?: boolean};
export type IJackpotPoolsChange = {
    [poolName: string]: IJackpotPoolChange;
};

export type IJackpotEntryData = {
    type: "withdrawFinished" | "cancelContributions" | "cancelWin" | "play" | "modification";
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

export async function getOrCreatePlayerState(loadPlayerState: (readOnly?: boolean) => Promise<IJackpotPlayerState>, config: IJackpotConfig) {
    return (
        (await loadPlayerState()) ?? {
            _rounds: {},
            _poolStatistics: Object.fromEntries(
                Object.keys(config.poolsConfig).map(poolName => [
                    poolName,
                    {
                        totalContribution: 0,
                        totalWin: 0,
                        winsCount: 0,
                    },
                ]),
            ),
            _roundJackpotsWon: [],
        }
    );
}

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
    time: number,
): {
    _poolAmounts: {[poolName: string]: IPoolAmounts};
    _pendingJackpotWins: {[entryId: number]: IJackpotWinData};
    _poolStatistics: {[poolName: string]: IPoolStatistics};
} {
    const {poolsConfig} = config;
    const {_poolAmounts, _pendingJackpotWins, _poolStatistics} = latestAccumulationData;

    for (const entry of entries) {
        const entryId = parseInt(entry.id as any);
        const {playerId, roundId, step, transactionId, poolsChange} = entry.data;

        const poolWins: {[poolName: string]: number} = {};
        Object.entries(poolsChange).forEach(([poolName, {contribution, seedContribution, isJackpotWin}]) => {
            if (contribution) {
                _poolAmounts[poolName].amount += contribution || 0;

                if (entry.data.type === "cancelWin") {
                    _poolStatistics[poolName].winsCount--;
                    // cancelWin contribution is deducted by reset at this point
                    _poolStatistics[poolName].totalWin -= contribution + config.poolsConfig[poolName].reset;
                } else {
                    _poolStatistics[poolName].totalContribution += contribution;
                }
            }

            if (seedContribution) {
                _poolAmounts[poolName].seedAmount += seedContribution || 0;
                _poolStatistics[poolName].totalContribution += seedContribution;
            }

            const poolAmount = _poolAmounts[poolName].amount;
            const poolSeedAmount = _poolAmounts[poolName].seedAmount;
            if (poolAmount < 0 || poolSeedAmount < 0) {
                logger.warn("Jackpot pool reached negative value due to cancels", {
                    latestAccumulationData,
                    entry,
                    _poolAmounts,
                });
            }

            if (isJackpotWin) {
                const winAmount = Math.max(0, floor(poolAmount, baseCurrencyDecimals)); // if pool is negative, pay 0
                poolWins[poolName] = winAmount;
                _poolAmounts[poolName].amount = poolAmount - winAmount + poolsConfig[poolName].reset + poolSeedAmount;
                _poolAmounts[poolName].seedAmount = 0;

                _poolStatistics[poolName].winsCount++;
                _poolStatistics[poolName].totalWin += winAmount;
            }
        });

        if (Object.entries(poolWins).length > 0) {
            _pendingJackpotWins[entryId] = {
                entryId,
                playerId,
                roundId,
                step,
                transactionId,
                poolWins,
                time,
            };
        }
    }

    Object.entries(_poolStatistics).forEach(([poolName, statistics]) => {
        const totalContributed = statistics.totalContribution + (statistics.winsCount + 1) * poolsConfig[poolName].reset;
        const totalAccrued = _poolAmounts[poolName].amount + _poolAmounts[poolName].seedAmount + statistics.totalWin;
        const difference = totalContributed - totalAccrued;
        if (Math.abs(difference) > Math.pow(10, -baseCurrencyDecimals)) {
            logger.error(`Jackpot pool ${poolName} contributions and payout are inconsistent by ${difference}`, {
                totalContributed,
                totalAccrued,
                difference,
                statistics,
                amounts: _poolAmounts[poolName],
                config: poolsConfig[poolName],
            });
        }
    });

    return {
        _poolAmounts,
        _pendingJackpotWins,
        _poolStatistics,
    };
}

export function synchronizeJackpotWin(winEntry: IStreamEntry<IJackpotEntryData>): IStreamAccumulator<IJackpotConfig, IJackpotEntryData, IJackpotAccumulationData> {
    return async ({config, entries, latestAccumulationData, time}) => {
        const {_poolAmounts, _pendingJackpotWins, _poolStatistics} = accumulateJackpotPools(config, latestAccumulationData, entries, time);

        const _jackpotWinData = _pendingJackpotWins[winEntry.id];
        delete _pendingJackpotWins[winEntry.id];

        if (!_jackpotWinData) {
            logger.error("Jackpot stream state inconsistent, transactionJackpot win needs to be present in pendingJackpotWins", {
                winEntry,
                latestAccumulationData,
                _poolAmounts,
                _pendingJackpotWins,
            });
        }

        return {
            data: {
                _poolAmounts,
                _poolStatistics,
                _pendingJackpotWins,
                _jackpotWinData,
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

        const jackpotWinData = accumulation.data._jackpotWinData!;
        const baseCurrencyJackpotWin = sum(Object.values(jackpotWinData.poolWins));
        const jackpotWin = baseCurrencyJackpotWin * roundState.currencyRate;

        const playerPoolWins: {[poolName: string]: IPlayerPoolWin} = {};
        for (const [poolName, amount] of Object.entries(jackpotWinData.poolWins)) {
            playerPoolWins[poolName] = {
                baseCurrencyAmount: amount,
                amount: amount * roundState.currencyRate,
                time: jackpotWinData.time,
            };
        }

        const totalRoundPoolWins = roundState?.totalRoundPoolWins ?? {};
        Object.entries(playerPoolWins).forEach(([poolName, {amount, baseCurrencyAmount, time}]) => {
            if (!totalRoundPoolWins[poolName]) {
                totalRoundPoolWins[poolName] = {amount: 0, baseCurrencyAmount: 0, time};
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
    const {poolsConfig} = config;

    if (!poolsConfig || Object.entries(poolsConfig).length === 0) {
        throw new Exception("Pools need to be configured");
    }

    const _poolAmounts: {[poolName: string]: IPoolAmounts} = {};
    const _poolStatistics: {[poolName: string]: IPoolStatistics} = {};

    for (const [poolName, poolConfig] of Object.entries(poolsConfig)) {
        _poolAmounts[poolName] = {amount: poolConfig.reset, seedAmount: 0};
        _poolStatistics[poolName] = {totalWin: 0, totalContribution: 0, winsCount: 0};
    }
    return {
        _poolAmounts,
        _poolStatistics,
        _pendingJackpotWins: {},
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
    const {_poolAmounts, _pendingJackpotWins, _poolStatistics} = accumulateJackpotPools(config, latestAccumulationData, entries, time);

    return {
        data: {
            _poolAmounts,
            _pendingJackpotWins,
            _poolStatistics,
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
    const {roundId, transactionId} = transaction;
    const roundState = playerState._rounds[roundId];

    Object.entries(roundState.poolsChange || {}).forEach(([poolName, poolChange]) => {
        playerState._poolStatistics[poolName].totalContribution += (poolChange.contribution || 0) + (poolChange.seedContribution || 0);
    });

    if (roundState.totalRoundPoolWins) {
        logger.info("Jackpot win deposit finished", {
            playerId: player.playerId,
            roundId: roundId,
            transactionId: transactionId,
            playerState,
        });

        Object.entries(roundState.totalRoundPoolWins).forEach(([poolName, roundPoolWin]) => {
            playerState._poolStatistics[poolName].totalWin += roundPoolWin.amount;
            playerState._poolStatistics[poolName].winsCount++;
        });

        if (playerState._roundJackpotsWon.length >= 10) {
            playerState._roundJackpotsWon.pop();
        }
        playerState._roundJackpotsWon.unshift({roundId, totalRoundPoolWins: roundState.totalRoundPoolWins});
    }

    delete playerState._rounds[transaction.roundId];

    return {playerState};
}

export async function campaignFeed({config, loadCampaignState, params}: {config: IJackpotConfig; loadCampaignState: () => Promise<IStreamCampaignState<IJackpotAccumulationData>>; params: Record<string, any>}) {
    const {data} = await loadCampaignState();
    const currencyRate = params?.currency ? await getCurrencyRate(params.currency, config.baseCurrency) : 1;
    return {
        poolAmounts: Object.fromEntries(Object.entries(data._poolAmounts).map(([poolName, pool]) => [poolName, Math.max(0, floor(pool.amount * currencyRate, baseCurrencyDecimals))])),
    };
}

export async function playerFeed({loadPlayerState}: {config: IJackpotConfig; loadPlayerState: () => Promise<IJackpotPlayerState>}) {
    const {_roundJackpotsWon} = await loadPlayerState();
    return {roundJackpotsWon: _roundJackpotsWon};
}

export const systemEvent: NonNullable<ITool["systemEvent"]> = async ({eventName, params, config, streamEntry}) => {
    if (eventName === "modifyPool") {
        if (!params.poolName) throw new Exception("Pool not specified");
        if (!params.value) throw new Exception("Value not specified");
        if (typeof params.value !== "number") throw new Exception("Value should be a number");
        if (!Object.keys(config.poolsConfig).find(poolName => poolName === params.poolName)) throw new Exception("Couldn't find pool to modify");

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
