import Exception from "@slotify/shared/lib/Exception";
import {IRandom, MAXIMAL_RANDOM_LIMIT} from "./IRandom";
import {randomInteger} from "../lib";

export function validateRandomLimit(limit: number) {
    if (!Number.isInteger(limit)) {
        throw new Exception("Random function limit must be an integer");
    }

    if (limit <= 0) {
        throw new Exception("Random function limit must be positive");
    }

    if (limit > MAXIMAL_RANDOM_LIMIT) {
        throw new Exception(`Random function limit cannot exceed 32-bit range (not greater than 2**32 = ${MAXIMAL_RANDOM_LIMIT})`);
    }
}

export function createRandom(): IRandom {
    return (limit = MAXIMAL_RANDOM_LIMIT) => {
        validateRandomLimit(limit);
        return randomInteger(limit);
    };
}

export function createRiggedRandom(numbers: number[]): IRandom {
    const clonedNumbers = [...numbers];

    return (limit = MAXIMAL_RANDOM_LIMIT) => {
        validateRandomLimit(limit);

        const nextNumber = clonedNumbers.shift();
        if (nextNumber !== undefined) {
            if (nextNumber >= limit) {
                throw new Exception("Cheated random number exceeds limit requested by the game");
            }
            return nextNumber;
        }

        // fallback to regular random numbers generation for partial cheats
        return randomInteger(limit);
    };
}

export function createMemorisingRandom(buffer: number[]): IRandom {
    return (limit = MAXIMAL_RANDOM_LIMIT) => {
        validateRandomLimit(limit);
        const newNumber = randomInteger(limit);
        buffer.push(newNumber);
        return newNumber;
    };
}
