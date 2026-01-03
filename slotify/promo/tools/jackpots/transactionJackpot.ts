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
    getOrCreatePlayerState,
    IJackpotAccumulationData,
    IJackpotConfig,
    IJackpotEntryData,
    IJackpotLog,
    IJackpotPlayerState,
    IJackpotPoolsChange,
    jackpotScheduledAccumulationInterval,
    playerFeed,
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
    snapshotCron: "* * * * *",

    create,

    accumulator,

    async withdraw({transaction, config, loadPlayerState}) {
        if (transaction.category !== "normal") return;

        const {poolsConfig} = config;

        const playerState: IJackpotPlayerState = await loadPlayerState();
        if (playerState && playerState._rounds[transaction.roundId]) {
            throw new Exception("Transaction Jackpot doesn't support side bets", {data: {transaction, playerState}});
        }

        let jackpotAmount = 0;
        for (const {contributionRate, seedContributionRate} of Object.values(poolsConfig)) {
            const playerCurrencyPoolChange = transaction.amount * contributionRate;
            const playerCurrencySeedChange = transaction.amount * seedContributionRate;
            jackpotAmount = jackpotAmount + playerCurrencyPoolChange + playerCurrencySeedChange;
        }

        return {jackpotAmount};
    },

    async withdrawFinished({transaction, player, config, loadPlayerState, streamEntry, streamSynchronizedAccumulator}) {
        if (transaction.category !== "normal") return;

        const {poolsConfig, baseCurrency} = config;

        const {currency, playerId} = player;
        const currencyRate = await getCurrencyRate(currency, baseCurrency);
        const {roundId, transactionId} = transaction;

        const random = createRandom();

        const playerCurrencyPoolsChange: IJackpotPoolsChange = {};
        for (const [poolName, {contributionRate, seedContributionRate, probability}] of Object.entries(poolsConfig)) {
            playerCurrencyPoolsChange[poolName] = {
                contribution: transaction.amount * contributionRate,
                seedContribution: transaction.amount * seedContributionRate,
            };
            const target = (probability * transaction.amount) / currencyRate;

            if (target > 1) {
                logger.error(`The bet amount ${transaction.amount} exceeds target probability and forces instant jackpot trigger`);
            }

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

        const {poolsConfig} = config;

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

        const cancelContributionsPoolsChange = Object.fromEntries(
            Object.entries(poolsChange!).map(([poolName, poolChange]) => [
                poolName,
                {
                    contribution: -poolChange.contribution!,
                    seedContribution: -poolChange.seedContribution!,
                    isJackpotWin: false,
                },
            ]),
        );

        const cancelContributionEntry = await streamEntry({
            type: "cancelContributions",
            playerId: player.playerId,
            roundId: transaction.roundId,
            transactionId: transaction.transactionId,
            poolsChange: cancelContributionsPoolsChange,
        });

        logger.info("Canceling transactionJackpot contributions finished", {transaction, cancelContributionEntry});

        let logs;
        if (roundState.isJackpotWin) {
            const cancelWinPoolsChange = Object.fromEntries(Object.entries(roundState.totalRoundPoolWins!).map(([poolName, {baseCurrencyAmount}]) => [poolName, {contribution: baseCurrencyAmount - poolsConfig[poolName].reset}]));

            const cancelWinEntry = await streamEntry({
                type: "cancelWin",
                playerId: player.playerId,
                roundId: transaction.roundId,
                transactionId: transaction.transactionId,
                poolsChange: cancelWinPoolsChange,
            });

            logger.warn("Canceling transactionJackpot win synchronization started", {
                transaction,
                playerState,
                cancelContributionEntry,
                cancelWinEntry,
            });
            const accumulation = await streamSynchronizedAccumulator(async ({entries, latestAccumulationData, time}) => {
                const data = accumulateJackpotPools(config, latestAccumulationData, entries, time);

                data._pendingJackpotWins = Object.fromEntries(Object.entries(data._pendingJackpotWins).filter(([, pendingJackpotWin]) => pendingJackpotWin.roundId !== transaction.roundId));

                return {data, nextAccumulationTime: time + jackpotScheduledAccumulationInterval};
            });
            logger.warn("Cancel transactionJackpot win successful", {
                transaction,
                playerState,
                cancelContributionEntry,
                cancelWinEntry,
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
                        entry: cancelWinEntry,
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

    playerFeed,

    campaignFeed,

    systemEvent,
};
