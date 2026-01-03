import Exception from "@slotify/shared/lib/Exception";
import {sendAlert} from "@slotify/shared/lib/sendAlert";

let alertSent = false;

const Ex = 16;
const N = Ex * 256;
const PValFailLimit = 330.5197 * Ex;
const FailCountLimit = 4; // given this limit, rough estimate of false-positive failures would be once every ~2_000_000_000_000_000 add samples

const counter1 = new Array(256).fill(0);
const counter2 = new Array(256).fill(0);
const counter3 = new Array(256).fill(0);
const counter4 = new Array(256).fill(0);
let numSamples = 0;

let failCount = 0;
let fatalFailure = false;
const failSums = new Array(3).fill(0);
const failCounters: number[][] = [new Array(256).fill(0), new Array(256).fill(0), new Array(256).fill(0)];

function addSample(n: number): boolean {
    const g1 = n & 0xff;
    const g2 = (n >> 8) & 0xff;
    const g3 = (n >> 16) & 0xff;
    const g4 = (n >> 24) & 0xff;

    counter1[g1]++;
    counter2[g2]++;
    counter3[g3]++;
    counter4[g4]++;

    numSamples++;
    if (numSamples >= N) {
        test();
    }

    return !fatalFailure;
}

function test() {
    numSamples = 0;

    checkFailure(counter1);
    checkFailure(counter2);
    checkFailure(counter3);
    checkFailure(counter4);

    for (let i = 0; i < 256; i++) {
        counter1[i] = 0;
        counter2[i] = 0;
        counter3[i] = 0;
        counter4[i] = 0;
    }
}

function checkFailure(counter: number[]): void {
    if (fatalFailure) {
        return;
    }

    let sum = 0;
    for (let i = 0; i < 256; i++) {
        const k = counter[i] - Ex;
        sum += k * k;
    }

    if (sum > PValFailLimit) {
        failSums[failCount] = sum;
        failCounters[failCount] = [...counter];

        failCount++;

        if (failCount >= FailCountLimit) {
            fatalFailure = true;
        }
    } else {
        failCount = 0;
    }
}

const toInt = Math.pow(2, 32);

function verify(number: number): void {
    if (!addSample(number * toInt)) {
        if (!alertSent) {
            alertSent = true;
            sendAlert("RNG Failure", "RNG monitoring failed. Please investigate.", true);
        }
        throw new Exception("RNG chi-squared test failed");
    }
}

function setPeriodicVerification(randFunction: () => number, interval: number): void {
    setInterval(() => {
        const toAdd = N - numSamples;
        for (let i = 0; i < toAdd; i++) {
            verify(randFunction());
        }
    }, interval);
}

function setBackgroundCycling(randFunction: () => number, interval: number): void {
    setInterval(() => {
        const n = Math.floor(randFunction() * 100) + 1; // range <1, 100>
        for (let i = 0; i < n; i++) {
            randFunction();
        }
    }, interval);
}

export {verify, setPeriodicVerification, setBackgroundCycling};
