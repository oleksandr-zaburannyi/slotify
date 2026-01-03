import fetch from "@slotify/shared/lib/fetch";
import {IGame, IWager} from "../IGame";
import {IRandom, MAXIMAL_RANDOM_LIMIT} from "@slotify/rng/lib/random/IRandom";
import fs from "fs";
import {validateRandomLimit} from "@slotify/rng/lib/random/factory";
import {unbiasedRandomInteger} from "@slotify/rng/lib/unbiasedRandomInteger";
import logger from "@slotify/shared/lib/logger";
import singleExecution from "../helper/singleExecution";

interface IGatiRng {
    acceptsWager: (wager: IWager) => boolean;
    random: IRandom;
    getNumbers: () => number[];
}

interface IGatiRngParams {
    game: IGame;
    action: string;
    cheat: string;
}

const rngUrl = process.env.RNG_SERVICE_ADDRESS || "http://localhost:50000";
const gameId: string = fs.existsSync("gati.json") ? JSON.parse(fs.readFileSync("gati.json").toString()).gameId : "1";
const rngPool = process.env.RNG_POOL ? parseInt(process.env.RNG_POOL, 10) : 20000; //size
const rngLimit = process.env.RNG_LIMIT ? parseInt(process.env.RNG_LIMIT, 10) : 1000; //minSize
let numbers: number[] = [];

logger.info(`RNG rngPool ${rngPool}`);
logger.info(`RNG rngLimit ${rngLimit}`);

async function fetchNumbers() {
    const response = await fetch(rngUrl + "/numbers?size=" + rngPool, {headers: {"X-Game-ID": gameId}});
    const fetchedNumbers = (await response.json()) as number[];
    numbers = fetchedNumbers.reverse().concat(numbers);
}

function createGatiRandom() {
    const consumedNumbers: number[] = [];
    return {
        random: (limit = MAXIMAL_RANDOM_LIMIT) => {
            validateRandomLimit(limit);
            return unbiasedRandomInteger(limit, () => {
                if (numbers.length === 0) {
                    throw new Error("Not enough RNG numbers cached");
                }
                const number = numbers.pop()!;
                consumedNumbers.push(number);
                return number;
            });
        },
        consumedNumbers,
    };
}

export async function createGatiRng({game, action, cheat}: IGatiRngParams): Promise<IGatiRng> {
    const cheatFunc = game.cheats && game.cheats[action] && game.cheats[action][cheat];

    await loadRngNumbers();

    const {random, consumedNumbers} = createGatiRandom();
    return {
        random,
        acceptsWager: cheatFunc || (() => true),
        getNumbers: () => consumedNumbers,
    };
}

export async function loadRngNumbers() {
    await singleExecution(async () => {
        while (numbers.length < rngLimit) {
            await fetchNumbers();
        }
    });
}
