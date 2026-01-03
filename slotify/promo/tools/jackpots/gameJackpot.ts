import {IStreamTool} from "../../util/ITool";
import {
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
    systemEvent,
} from "./jackpots";
import Exception from "@slotify/shared/lib/Exception";
import {getCurrencyRate} from "../../util/currencyRates";

type IPlayData = {pools: IJackpotPoolsChange};

export const gameJackpot: IStreamTool<IJackpotConfig, IJackpotPlayerState, IJackpotLog, IJackpotEntryData, IJackpotAccumulationData, IPlayData> = {
    autoOptIn: true,

    create,

    accumulator,

    async play({config, playRequest, player, loadPlayerState, streamEntry, streamSynchronizedAccumulator}) {
        const {playerId, currency} = player;
        const {roundId, step, data} = playRequest;
        const {pools} = data;

        Object.keys(pools)
            .filter(poolName => !config[poolName])
            .forEach(poolName => {
                throw new Exception("Game Jackpot pool name doesn't exist", {
                    data: {
                        playerId,
                        roundId,
                        config,
                        poolName,
                    },
                });
            });

        const currencyRate = await getCurrencyRate(currency);

        const poolsChange = await calculateBaseCurrencyPoolsChange(pools, currencyRate);

        const entry = await streamEntry({
            type: "play",
            playerId,
            roundId,
            step,
            poolsChange,
        });

        const playerState = (await loadPlayerState()) ?? {_rounds: {}};
        playerState._rounds[roundId] = {...playerState._rounds[roundId], poolsChange};

        const jackpotWinResult = await evaluateJackpotWin(poolsChange, entry, streamSynchronizedAccumulator, playerState._rounds[roundId]);

        if (jackpotWinResult) {
            const {playerPoolWins, jackpotWin, baseCurrencyJackpotWin, totalRoundPoolWins} = jackpotWinResult;
            playerState._rounds[roundId] = {...playerState._rounds[roundId], isJackpotWin: true, totalRoundPoolWins};

            return {
                data: {
                    jackpotWin,
                    baseCurrencyJackpotWin,
                    poolWins: playerPoolWins,
                },
                playerState,
            };
        }

        return {
            playerState,
        };
    },

    deposit,

    depositFinished,

    campaignFeed,

    systemEvent,
};
