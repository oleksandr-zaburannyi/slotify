import {createRandom} from "@slotify/rng/lib/random/factory";
import sum from "@slotify/shared/lib/sum";

export interface IPoolWin {
    amount: number;
    baseCurrencyAmount: number;
}

export interface ITransactionJackpotData {
    jackpotWin: number;
    baseCurrencyJackpotWin: number;
    poolWins?: {[poolName: string]: IPoolWin};
}

export interface IGameJackpotData {
    pools?: {
        [poolName: string]: {
            contribution?: number;
            seedContribution?: number;
            isJackpotWin?: boolean;
        };
    };
}

export function createUpdateTransactionJackpot(configJson: string = "{}"): (bet: number) => ITransactionJackpotData | undefined {
    const config: {
        [poolId: string]: {contributionRate: number; seedContributionRate: number; reset: number; probability: number};
    } = JSON.parse(configJson);

    const random = createRandom();

    const poolAmounts = Object.fromEntries(Object.entries(config).map(([poolName, poolConfig]) => [poolName, {amount: poolConfig.reset, seedAmount: 0}]));

    return (bet: number) => {
        let poolWins: {[poolName: string]: IPoolWin} | undefined;

        for (const [poolName, {contributionRate, seedContributionRate, probability}] of Object.entries(config)) {
            const contribution = bet * contributionRate;
            const seedContribution = bet * seedContributionRate;
            poolAmounts[poolName].amount += contribution;
            poolAmounts[poolName].seedAmount += seedContribution;

            if (random() / 2 ** 32 < probability * bet) {
                if (!poolWins) {
                    poolWins = {};
                }
                const amount = poolAmounts[poolName].amount;
                poolAmounts[poolName].amount = poolAmounts[poolName].seedAmount + config[poolName].reset;
                poolAmounts[poolName].seedAmount = 0;
                poolWins[poolName] = {amount, baseCurrencyAmount: amount};
            }
        }

        return poolWins
            ? {
                  jackpotWin: sum(Object.values(poolWins).map(poolWin => poolWin.amount)),
                  baseCurrencyJackpotWin: sum(Object.values(poolWins).map(poolWin => poolWin.baseCurrencyAmount)),
                  poolWins,
              }
            : undefined;
    };
}
