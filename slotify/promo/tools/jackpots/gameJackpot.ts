import {IStreamTool} from "../../util/ITool";
import {
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

        const {poolsConfig, baseCurrency} = config;

        Object.keys(pools)
            .filter(poolName => !poolsConfig[poolName])
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

        const currencyRate = await getCurrencyRate(currency, baseCurrency);

        const poolsChange = await calculateBaseCurrencyPoolsChange(pools, currencyRate);

        const entry = await streamEntry({
            type: "play",
            playerId,
            roundId,
            step,
            poolsChange,
        });

        const playerState = await getOrCreatePlayerState(loadPlayerState, config);

        playerState._rounds[roundId] = {...playerState._rounds[roundId], poolsChange, currencyRate};

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
