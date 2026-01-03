#!/usr/bin/env node

import {random} from "./lib";

const numbers = [];
const total = parseInt(process.argv[2], 10) || 10;
for (let i = 0; i < total; i++) {
    numbers.push(random());
}

console.log(numbers.join(","));
process.exit(0);
