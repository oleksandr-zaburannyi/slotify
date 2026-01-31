import {simulator} from "./simulator";
import {IGame, IPlayRequest, IPlayResponse, IWager} from "../IGame";
import {createRng} from "../helper/createRng";
import {IRoundRngState} from "@slotify/rng/lib/random/IRoundRngState";
import {v4} from "uuid";
import {createRandom} from "@slotify/rng/lib/random/factory";
import Exception from "@slotify/shared/lib/Exception";
import {mockBetLimits} from "../helper/mockBetLimits";
import {createUpdateTransactionJackpot, ITransactionJackpotData} from "../helper/jackpots";

type InitData = {
    action: string;
    strategy?: string;
    config: any;
    variant?: string;
    bet: number;
    coin: number;
    roundRngState: IRoundRngState;
    provablyFair: boolean;
    updateTransactionJackpot: (bet: number) => ITransactionJackpotData | undefined;
};

simulator<IGame, IWager, {response: IPlayResponse; nonce: number}, InitData>(
    "slotify-stats",
    command => {
        command
            .option("-a, --action <string>", "initial action", "main")
            .option("-b, --bet <number>", "initial bet", parseFloat, 100)
            .option("-s, --strategy <string>", "simulation strategy")
            .option("-v, --variant <string>", "config variant")
            .option("--pf, --provablyFair <boolean>", "use provably fair", "false")
            .option("--tj, --transactionJackpot <string>", "transaction jackpot config");
    },
    (game, {action, bet, strategy, variant, provablyFair, transactionJackpot}) => {
        const currency = "eur";
        const bets = typeof game.bets === "function" ? game.bets(variant) : game.bets;
        const coin = bets && bets[action] && bets[action].coin;
        return {
            "Bet": `${bet} ${currency} (${coin} coins)`,
            "Action": action || "",
            "Strategy": strategy || "",
            "Variant": variant || "",
            "Provably fair": provablyFair,
            "Transaction Jackpot config": transactionJackpot || "{}",
        };
    },
    async (env, game) => {
        const action = env.action!;
        const variant = env.variant;
        const bets = typeof game.bets === "function" ? game.bets(variant) : game.bets;
        const coin = bets && bets[action] && bets[action].coin;

        return {
            action,
            strategy: env.strategy,
            config: game.config && game.config(env.variant),
            variant,
            bet: parseFloat(env.bet!),
            coin,
            roundRngState: {serverSeed: v4(), clientSeed: v4(), nonce: 0, cursor: 0},
            provablyFair: env.provablyFair === "true",
            updateTransactionJackpot: createUpdateTransactionJackpot(env.transactionJackpot),
        };
    },
    false,
    ({action, strategy, config, variant, bet, coin, roundRngState, provablyFair, updateTransactionJackpot}, runData, game) => {
        let response = runData?.response;
        roundRngState.nonce = runData?.nonce || 0;
        const wagers: IWager[] = [];
        const request: IPlayRequest = {
            action,
            bet,
            config,
            variant,
            state: response && response.state,
            coin,
        };
        do {
            const rng = createRng({game, action, roundRngState: provablyFair ? roundRngState : undefined});

            if (game.simulate) {
                const simulateResult = game.simulate({strategy, wagers, state: response?.state, variant}, createRandom());

                if (simulateResult) {
                    if (simulateResult.action && response?.next && !response?.next.includes(simulateResult.action)) {
                        throw new Exception("Simulate method returned illegal action");
                    }
                }

                Object.assign(request, simulateResult);
            }

            if (request.sideBet) {
                if (!game.validate) {
                    throw new Exception("Validation needs to be implemented for games with side bets");
                }

                if (!game.validate!(request, mockBetLimits)) {
                    throw new Exception("Side Bet validation failed");
                }
            }

            const transactionJackpotData = updateTransactionJackpot(request.bet);
            if (transactionJackpotData) {
                request.promo = {transactionJackpot: transactionJackpotData};
            }

            response = game.play(request, rng.random, mockBetLimits);
            const wager: IWager = {...request, ...response};
            wagers.push(wager);

            request.action = response.next && response.next.length > 0 ? response.next[0] : action;
            request.sideBet = undefined;
            request.state = wager.state;
            roundRngState.cursor = rng.getPayload()?.newRngCursor;
        } while (response.next && response.next.length > 0);

        return {runData: {response, nonce: roundRngState.nonce + 1}, statsData: wagers};
    },
    game => game.stats || {},
    (stat, wagers) => stat.processAllWagers(wagers),
);
