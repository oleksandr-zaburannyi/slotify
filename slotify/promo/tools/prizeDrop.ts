import Exception from "@slotify/shared/lib/Exception";
import {ITool} from "../util/ITool";
import {getCurrencies} from "../util/currencyRates";
import exchangePrizeValue from "../util/exchangePrizeValue";
import validateCampaignPrizes, {IPrizeConfig, validateCurrencyOverrides} from "../util/validateCampaignPrizes";
import {createRandom} from "@slotify/rng/lib/random/factory";
import {incrementQualifiedBets, isQualifyingBet} from "../util/qualifiedBets";

type IPrizeWon = {roundId: string; type: "cash" | "item" | "multiplier"; value: number | string; winTime: number};
type ICampaignConfig = {qualifyingBet: number; qualifyingBetOverrides?: Record<string, number>; probability: number; boostedProbabilityStart: number; prizes: IPrizeConfig[]};
type ICampaignState = {amountsLeft: number[]; _fixedCurrencyRates: Record<string, number>};
type IPlayerState = {qualifiedBets?: number; exchangedQualifyingBet: number; exchangedCashValues: number[]; exchangedLimits: number[]; prizesWon: IPrizeWon[]; _winningRoundId: string; _winningRoundBet: number};

function calculateCurrentProbability(config: ICampaignConfig, end: Date) {
    if (!config.boostedProbabilityStart) {
        return config.probability;
    }

    const nowMilliseconds = Date.now();
    const startMilliseconds = config.boostedProbabilityStart;
    const endMilliseconds = new Date(end).getTime();

    const probability = nowMilliseconds > startMilliseconds ? config.probability + ((1 - config.probability) * (nowMilliseconds - startMilliseconds)) / (endMilliseconds - startMilliseconds) : config.probability;

    return Math.max(0, Math.min(1, probability));
}

function randomizePrizeWonIndex(campaignState: ICampaignState, config: ICampaignConfig) {
    const weightedAmounts = campaignState.amountsLeft.map((amountLeft, i) => amountLeft * (config.prizes[i].weight ?? 1));
    const totalWeighted = weightedAmounts.reduce((sum, w) => sum + w, 0);

    const random = createRandom();
    const index = random(totalWeighted);

    let prizeIndex = 0;
    let prizesSkipped = weightedAmounts[prizeIndex];
    while (index >= prizesSkipped) {
        prizeIndex++;
        prizesSkipped += weightedAmounts[prizeIndex];
    }
    return prizeIndex;
}

function validateCommonConfig(config: ICampaignConfig, end: number) {
    if (config.qualifyingBet === undefined || typeof config.qualifyingBet !== "number") throw new Exception("Qualifying Bet needs to be configured");

    validateCurrencyOverrides(config.qualifyingBetOverrides, "Qualifying bet");

    if (!end) throw new Exception("Prize Drop campaign requires End date to be set");

    if (config.boostedProbabilityStart !== undefined && end <= config.boostedProbabilityStart) throw new Exception("Probability Scaling requires End date to be properly configured");

    if (typeof config.probability !== "number" || config.probability <= 0 || config.probability > 1) throw new Exception("Prize Drop probability needs to be a number from (0,1] range");
}

function isCampaignFinished(campaignState: ICampaignState) {
    const totalAmountLeft = campaignState.amountsLeft.reduce((totalAmountsLeft, amountLeft) => totalAmountsLeft + amountLeft, 0);

    return totalAmountLeft === 0;
}

function getExchangedCashValue(prizeWonConfig: IPrizeConfig, playerState: IPlayerState, prizeIndex: number) {
    const precisionNumbersMapper = (number: number, decimals: number = 12) => Number(number.toFixed(decimals));

    switch (prizeWonConfig.type) {
        case "cash":
            return playerState.exchangedCashValues[prizeIndex];
        case "multiplier":
            const exchangedLimit = Number.isFinite(prizeWonConfig.limit) ? playerState.exchangedLimits[prizeIndex] : Infinity;
            return precisionNumbersMapper(Math.min(exchangedLimit, (prizeWonConfig.value as number) * playerState._winningRoundBet));
    }
}

export const prizeDrop: ITool<ICampaignConfig, IPlayerState, ICampaignState> = {
    async create({config, end}) {
        validateCommonConfig(config, end);

        validateCampaignPrizes(config.prizes);

        const currencies = await getCurrencies();
        const _fixedCurrencyRates = Object.fromEntries(currencies.map(item => [item.currency, item.rate]));

        return {amountsLeft: config.prizes.map(prize => prize.amount), _fixedCurrencyRates};
    },

    async edit(previousCampaign, previousState, {config, end}) {
        validateCommonConfig(config, end);

        if (JSON.stringify(previousCampaign.config.prizes) !== JSON.stringify(config.prizes)) throw new Exception("Prize Drop prizes cannot be edited");

        if (previousCampaign.config.qualifyingBet !== config.qualifyingBet) throw new Exception("Prize Drop qualifying bet cannot be edited");

        if (JSON.stringify(previousCampaign.config.qualifyingBetOverrides) !== JSON.stringify(config.qualifyingBetOverrides)) throw new Exception("Prize Drop qualifying bet overrides cannot be edited");

        return previousState;
    },

    async init({config, player, loadCampaignState}): Promise<any> {
        const campaignState = await loadCampaignState(true);

        const fixedCurrencyRate = campaignState._fixedCurrencyRates[player.currency];
        if (fixedCurrencyRate === undefined) {
            throw new Exception(`Currency ${player.currency} not found in campaign rates`);
        }

        // Check for qualifying bet currency override, fall back to exchange calculation
        const exchangedQualifyingBet = config.qualifyingBetOverrides?.[player.currency] ?? config.qualifyingBet * fixedCurrencyRate;

        // Check for prize currency overrides, fall back to exchange calculation
        const exchangedCashValues = config.prizes.map(prize => {
            if (prize.type !== "cash") return 0;
            return prize.currencyOverrides?.[player.currency] ?? exchangePrizeValue(prize.value as number, fixedCurrencyRate);
        });

        // Check for multiplier limit currency overrides, fall back to exchange calculation
        const exchangedLimits = config.prizes.map(prize => {
            if (prize.type !== "multiplier" || !Number.isFinite(prize.limit)) return 0;
            return prize.currencyOverrides?.[player.currency] ?? exchangePrizeValue(prize.limit, fixedCurrencyRate);
        });

        return {
            playerState: {
                qualifiedBets: 0,
                exchangedQualifyingBet,
                exchangedCashValues,
                exchangedLimits,
                prizesWon: [],
            },
        };
    },

    async visible({loadCampaignState}): Promise<boolean> {
        const campaignState = await loadCampaignState(true); // read only

        return !isCampaignFinished(campaignState);
    },

    async withdrawFinished({transaction, config, loadPlayerState, end}): Promise<any> {
        const playerState = await loadPlayerState();

        if (!isQualifyingBet(transaction.amount, playerState.exchangedQualifyingBet)) {
            return {};
        }

        const currentProbability = calculateCurrentProbability(config, end);

        const random = createRandom();
        const rngResult = random() / 2 ** 32;

        if (rngResult >= currentProbability) {
            return {
                playerState: {
                    ...playerState,
                    qualifiedBets: incrementQualifiedBets(playerState.qualifiedBets),
                },
            };
        }

        return {
            playerState: {
                ...playerState,
                qualifiedBets: incrementQualifiedBets(playerState.qualifiedBets),
                _winningRoundId: transaction.roundId,
                _winningRoundBet: transaction.amount,
            },
        };
    },

    async depositFinished({transaction, config, player, loadCampaignState, loadPlayerState}): Promise<any> {
        const campaignState = await loadCampaignState(true); // read only check

        if (isCampaignFinished(campaignState)) {
            // finish player's campaign if it was finished meanwhile
            return {
                finished: true,
            };
        }

        const playerState = await loadPlayerState();

        if (!playerState._winningRoundId) {
            return {};
        }

        if (playerState._winningRoundId !== transaction.roundId) {
            // remove winning roundId if player switched to different game
            return {
                playerState: {
                    ...playerState,
                    _winningRoundId: undefined,
                },
            };
        }

        const lockedCampaignState = await loadCampaignState(); // lock campaign state
        if (isCampaignFinished(lockedCampaignState)) {
            // finish player's campaign if it was finished meanwhile
            return {
                finished: true,
            };
        }

        const prizeIndex = randomizePrizeWonIndex(lockedCampaignState, config);

        const prizeWonConfig = config.prizes[prizeIndex];
        const prizeJustWon = {
            roundId: transaction.roundId,
            prizeIndex,
            type: prizeWonConfig.type,
            value: prizeWonConfig.value,
            exchangedCashValue: getExchangedCashValue(prizeWonConfig, playerState, prizeIndex),
            exchangedLimit: playerState.exchangedLimits[prizeIndex],
            winTime: Date.now(),
        };

        const newCampaignState = {
            _fixedCurrencyRates: lockedCampaignState._fixedCurrencyRates,
            amountsLeft: [...lockedCampaignState.amountsLeft],
        };
        newCampaignState.amountsLeft[prizeIndex]--;

        const newPlayerState = {
            qualifiedBets: playerState.qualifiedBets,
            exchangedQualifyingBet: playerState.exchangedQualifyingBet,
            exchangedCashValues: playerState.exchangedCashValues,
            exchangedLimits: playerState.exchangedLimits,
            prizesWon: [...playerState.prizesWon, prizeJustWon],
            _winningRoundId: undefined,
        };

        const isCashType = ["cash", "multiplier"].includes(prizeJustWon.type);
        const newPrizes = [
            {
                playerId: player.playerId,
                type: isCashType ? "cash" : "item",
                data: isCashType ? {amount: prizeJustWon.exchangedCashValue as number, currency: player.currency} : {name: prizeJustWon.value as string},
                comment: prizeJustWon.type === "multiplier" ? `x${prizeJustWon.value} bet` : undefined,
            },
        ];

        return {
            playerState: newPlayerState,
            campaignState: newCampaignState,
            prizes: newPrizes,
            finished: newCampaignState.amountsLeft.every(amountLeft => amountLeft === 0), // finish campaign for the player
        };
    },
};
