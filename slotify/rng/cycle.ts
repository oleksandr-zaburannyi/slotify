const crypto = require("crypto");

// default 10 minutes
const cyclingInterval = process.env.RNG_CYCLING_INTERVAL ? parseFloat(process.env.RNG_CYCLING_INTERVAL) : 10 * 60 * 1000;
const cyclingLimit = process.env.RNG_CYCLING_LIMIT ? parseInt(process.env.RNG_CYCLING_LIMIT) : 100;

export function setBackgroundCycling(random: () => number): void {
    setInterval(() => {
        const n = 1 + crypto.randomInt(cyclingLimit);
        for (let i = 0; i < n; i++) {
            random();
        }
    }, cyclingInterval);
}
