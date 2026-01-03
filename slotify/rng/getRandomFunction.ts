const isaac = require("./isaac.js");
import MersenneTwister from "mersenne-twister";
import Exception from "@slotify/shared/lib/Exception";

const algorithm: string = process.env.RNG_ALGORITHM || "isaac";

function getRandomFunction(): () => number {
    switch (algorithm) {
        case "isaac":
            isaac.seed([require("os").freemem(), process.pid, require("crypto").randomInt(Math.pow(2, 48) - 1), Date.now()]);
            return (): number => isaac.random();
        case "mersenne-twister":
            const mt = new MersenneTwister();
            return (): number => mt.random();
        default:
            throw new Exception("RNG algorithm " + algorithm + " does not exist");
    }
}

export default getRandomFunction;
