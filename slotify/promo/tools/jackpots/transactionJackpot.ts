import {IStreamTool} from "../../util/ITool";
import {
    accumulateJackpotPools,
    accumulator,
    calculateBaseCurrencyPoolsChange,
    campaignFeed,
    create,
    deposit,
    depositFinished,
    evaluateJackpotWin,
    IJackpotAccumulationData,
    IJackpotConfig,
    IJackpotEntryData,
    IJackpotLog,
    IJackpotPlayerState,
    IJackpotPoolsChange,
    jackpotScheduledAccumulationInterval,
    sumRoundPoolWins,
    systemEvent,
} from "./jackpots";
import {createRandom} from "@slotify/rng/lib/random/factory";
import {getCurrencyRate} from "../../util/currencyRates";
import logger from "@slotify/shared/lib/logger";
import Exception from "@slotify/shared/lib/Exception";

type ITransactionJackpotConfig = IJackpotConfig<{
    contributionRate: number;
    seedContributionRate: number;
    probability: number;
    reset: number;
}>;

export const transactionJackpot: IStreamTool<ITransactionJackpotConfig, IJackpotPlayerState, IJackpotLog, IJackpotEntryData, IJackpotAccumulationData> = {
    autoOptIn: true,

    create,

    accumulator,

    async withdraw({transaction, config, loadPlayerState}) {
        if (transaction.category !== "normal") return;

        const playerState: IJackpotPlayerState = await loadPlayerState();
        if (playerState && playerState._rounds[transaction.roundId]) {
            throw new Exception("Transaction Jackpot doesn't support side bets", {data: {transaction, playerState}});
        }

        let jackpotAmount = 0;
        for (const {contributionRate, seedContributionRate} of Object.values(config)) {
            const playerCurrencyPoolChange = transaction.amount * contributionRate;
            const playerCurrencySeedChange = transaction.amount * seedContributionRate;
            jackpotAmount = jackpotAmount + playerCurrencyPoolChange + playerCurrencySeedChange;
        }

        return {jackpotAmount};
    },

    async withdrawFinished({transaction, player, config, loadPlayerState, streamEntry, streamSynchronizedAccumulator}) {
        if (transaction.category !== "normal") return;

        const {currency, playerId} = player;
        const currencyRate = await getCurrencyRate(currency);
        const {roundId, transactionId} = transaction;

        const random = createRandom();

        const playerCurrencyPoolsChange: IJackpotPoolsChange = {};
        for (const [poolName, {contributionRate, seedContributionRate, probability}] of Object.entries(config)) {
            playerCurrencyPoolsChange[poolName] = {
                contribution: transaction.amount * contributionRate,
                seedContribution: transaction.amount * seedContributionRate,
            };
            if (random() / 2 ** 32 < (probability * transaction.amount) / currencyRate) {
                playerCurrencyPoolsChange[poolName].isJackpotWin = true;
            }
        }

        const poolsChange = await calculateBaseCurrencyPoolsChange(playerCurrencyPoolsChange, currencyRate);

        const entry = await streamEntry({
            type: "withdrawFinished",
            playerId: player.playerId,
            roundId,
            transactionId,
            poolsChange,
        });

        const playerState = await getOrCreatePlayerState(loadPlayerState, config);
        playerState._rounds[transaction.roundId] = {poolsChange, currencyRate};

        const jackpotWinResult = await evaluateJackpotWin(poolsChange, entry, streamSynchronizedAccumulator, playerState._rounds[transaction.roundId]);

        if (jackpotWinResult) {
            const {playerPoolWins, jackpotWin, baseCurrencyJackpotWin, totalRoundPoolWins, accumulation} = jackpotWinResult;
            playerState._rounds[transaction.roundId].isJackpotWin = true;
            playerState._rounds[transaction.roundId].totalRoundPoolWins = totalRoundPoolWins;
            return {
                data: {
                    jackpotWin,
                    baseCurrencyJackpotWin,
                    poolWins: playerPoolWins,
                },
                playerState,
                logs: [
                    {
                        name: "win",
                        data: {
                            playerId,
                            roundId,
                            transactionId,
                            currency,
                            currencyRate,
                            jackpotWin,
                            baseCurrencyJackpotWin,
                            entry,
                            accumulation,
                            playerState,
                        },
                    },
                ],
            };
        }

        return {playerState};
    },

    async cancel({transaction, config, player, loadPlayerState, streamEntry, streamSynchronizedAccumulator}) {
        if (transaction.category !== "normal") return;

        const playerState = (await loadPlayerState()) ?? {_rounds: {}};
        const roundState = playerState._rounds[transaction.roundId];

        if (!roundState) {
            logger.info("Withdraw was not processed by the Transaction Jackpot or was cancelled already (ignoring cancelation)", {
                transaction,
                playerState,
            });
            return;
        }

        if (roundState.depositStatus === "requested") {
            logger.error("Cannot cancel jackpot win that deposit was already requested (ignoring cancelation)", {
                transaction,
                playerState,
            });
            return;
        }

        logger.info("Canceling transactionJackpot contributions started", {transaction, playerState});

        const {poolsChange} = roundState;

        const negativePoolsChange = Object.fromEntries(
            Object.entries(poolsChange!).map(([poolId, poolChange]) => [
                poolId,
                {
                    contribution: -poolChange.contribution!,
                    seedContribution: -poolChange.seedContribution!,
                    isJackpotWin: false,
                },
            ]),
        );

        const entry = await streamEntry({
            type: "cancel",
            playerId: player.playerId,
            roundId: transaction.roundId,
            transactionId: transaction.transactionId,
            poolsChange: negativePoolsChange,
        });
        logger.info("Canceling transactionJackpot contributions finished", {transaction, entry});

        let logs;
        if (roundState.isJackpotWin) {
            logger.warn("Canceling transactionJackpot win synchronization started", {transaction, playerState, entry});
            const accumulation = await streamSynchronizedAccumulator(async ({entries, latestAccumulationData, time}) => {
                const {poolAmounts, poolStatistics} = latestAccumulationData;

                Object.entries(roundState.totalRoundPoolWins!).forEach(([poolName, {baseCurrencyAmount}]) => {
                    const pool = poolAmounts[poolName];
                    pool.amount = pool.amount + (baseCurrencyAmount - config[poolName].reset);
                    const statistics = poolStatistics[poolName];
                    statistics.winsCount--;
                    statistics.totalWin -= baseCurrencyAmount;
                });

                const accumulationData = {...latestAccumulationData, poolAmounts};
                const data = accumulateJackpotPools(config, accumulationData, entries);

                data.pendingJackpotWins = Object.fromEntries(Object.entries(data.pendingJackpotWins).filter(([, pendingJackpotWin]) => pendingJackpotWin.roundId !== transaction.roundId));

                return {data, nextAccumulationTime: time + jackpotScheduledAccumulationInterval};
            });
            logger.warn("Cancel transactionJackpot win successful", {
                transaction,
                playerState,
                entry,
                synchronizedAccumulatorResult: accumulation,
            });
            const roundWins = sumRoundPoolWins(roundState);
            logs = [
                {
                    name: "cancel",
                    data: {
                        playerId: player.playerId,
                        roundId: transaction.roundId,
                        transactionId: transaction.transactionId,
                        currency: player.currency,
                        currencyRate: roundState.currencyRate,
                        ...roundWins,
                        entry,
                        accumulation,
                        playerState,
                    },
                },
            ];
        }

        delete playerState._rounds[transaction.roundId];

        return {playerState, logs};
    },

    deposit,

    depositFinished,

    campaignFeed,

    systemEvent,
};

async function getOrCreatePlayerState(loadPlayerState: (readOnly?: boolean) => Promise<IJackpotPlayerState>, config: ITransactionJackpotConfig) {
    return (
        (await loadPlayerState()) ?? {
            _rounds: {},
            _poolStatistics: Object.fromEntries(
                Object.keys(config).map(poolName => [
                    poolName,
                    {
                        totalContribution: 0,
                        totalWin: 0,
                        winsCount: 0,
                    },
                ]),
            ),
        }
    );
}
