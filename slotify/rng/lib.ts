import os from "os";

(global as any).os = os;

import {setBackgroundCycling, setPeriodicVerification, verify} from "./verify";
import getRandomFunction from "./getRandomFunction";
import randomIntegerFn from "./randomInteger";

const randFunction: () => number = getRandomFunction();

function random(): number {
    const number = randFunction();
    verify(number);
    return number;
}

setPeriodicVerification(randFunction, 10 * 60 * 1000 /* 10 minutes */);
setBackgroundCycling(randFunction, 10 * 60 * 1000 /* 10 minutes */);

export {random};
export const randomInteger = (limit: number) => randomIntegerFn(limit, random);
