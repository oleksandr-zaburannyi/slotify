const isaac = require("./isaac.js");
const crypto = require("crypto");

export function seed() {
    isaac.seed([require("os").freemem(), process.pid, Date.now(), ...crypto.randomBytes(256 - 3)]);
}

// default 24 hours
const reseedingInterval = process.env.RNG_RESEEDING_INTERVAL ? parseFloat(process.env.RNG_RESEEDING_INTERVAL) : 24 * 60 * 60 * 1000;

export function setPeriodicReseeding(): void {
    setInterval(() => {
        seed();
    }, reseedingInterval);
}
