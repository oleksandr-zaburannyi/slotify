import {setPeriodicVerification, verify} from "./verify";
import {seed, setPeriodicReseeding} from "./seed";
import {setBackgroundCycling} from "./cycle";
import {unbiasedRandomInteger} from "./unbiasedRandomInteger";

const isaac = require("./isaac.js");

seed();
setPeriodicReseeding();
setPeriodicVerification(() => isaac.random());

export const random = () => {
    const number = isaac.random();
    verify(number);
    return number;
};

setBackgroundCycling(random);

const randomInt32 = () => random() / 2.3283064365386963e-10; //2^-32;
export const randomInteger = (limit: number) => unbiasedRandomInteger(limit, randomInt32);
