import {IRoundRngState} from "@slotify/rng/lib/random/IRoundRngState";
import {IGame, IWager} from "../IGame";
import {IRandom} from "@slotify/rng/lib/random/IRandom";
import {createRandom, createRiggedRandom} from "@slotify/rng/lib/random/factory";
import {createProvablyFairMultiplayerRng, createProvablyFairRng} from "@slotify/rng/lib/random/createProvablyFairRng";
import {IDrawRngState} from "@slotify/rng/lib/random/IDrawRngState";

export interface IGdkMultiplayerRng {
    random: IRandom;
    getPayload: () => any;
}

export interface IGdkRng extends IGdkMultiplayerRng {
    acceptsWager: (wager: IWager) => boolean;
}

export interface IGdkRngParams {
    game: IGame;
    action: string;
    roundRngState?: IRoundRngState;
    cheat?: string;
}

export function createRng({game, action, roundRngState, cheat}: IGdkRngParams): IGdkRng {
    const cheatFunc = cheat && game.cheats && game.cheats[action] && game.cheats[action][cheat];
    if (cheatFunc) {
        return {
            random: createRandom(),
            acceptsWager: cheatFunc,
            getPayload: () => (roundRngState ? {newRngCursor: roundRngState.cursor} : undefined),
        };
    }

    const cheatRNGSequence = (cheat && cheat.indexOf("rng:") === 0 && cheat.substring("rng:".length).split(",").map(parseFloat)) || null;
    if (cheatRNGSequence) {
        return {
            random: createRiggedRandom(cheatRNGSequence),
            acceptsWager: () => true,
            getPayload: () => (roundRngState ? {newRngCursor: roundRngState.cursor} : undefined),
        };
    }

    if (roundRngState) {
        const provablyFairRng = createProvablyFairRng(roundRngState);
        return {
            random: provablyFairRng.random,
            acceptsWager: () => true,
            getPayload: () => ({newRngCursor: provablyFairRng.getRngCursor()}),
        };
    }

    return {
        random: createRandom(),
        acceptsWager: () => true,
        getPayload: () => undefined,
    };
}

export function createMultiplayerRng(rngState: IDrawRngState): IGdkMultiplayerRng {
    if (rngState) {
        const provablyFairRng = createProvablyFairMultiplayerRng(rngState);
        return {
            random: provablyFairRng.random,
            getPayload: () => ({newRngCursor: provablyFairRng.getRngCursor()}),
        };
    }

    return {
        random: createRandom(),
        getPayload: () => undefined,
    };
}
