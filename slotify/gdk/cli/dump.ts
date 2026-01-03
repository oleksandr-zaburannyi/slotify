import {round} from "@slotify/shared/lib/round";
import {program} from "commander";
import * as fs from "fs";
import * as path from "path";
import {IGame, IPlayRequest, IPlayResponse} from "../IGame";
import * as tsNode from "ts-node";
import {createMemorisingRandom} from "@slotify/rng/lib/random/factory";
import {mockBetLimits} from "../helper/mockBetLimits";

function parseIterations(value: string): number {
    const lastChar = value.charAt(value.length - 1).toLowerCase();
    const multipliers: Record<string, number> = {"k": 1000, "m": 1000000, "b": 1000000000};

    for (const abbr in multipliers) {
        if (lastChar === abbr) {
            return parseFloat(value.substr(0, value.length - 1)) * multipliers[abbr];
        }
    }
    return parseFloat(value);
}

if (process.argv.length === 2) {
    process.argv.push("--help");
}
program
    .name("slotify-dump")
    .requiredOption("-g, --game <string>", "path to the game (required)")
    .option("-i, --iterations <number>", "number of iterations to simulate", parseIterations, 1000000)
    .option("-a, --startingAction <string>", "action", "main")
    .option("--ia, --initialAction <string>", "initial action")
    .option("-b, --bet <number>", "initial bet", parseFloat, 1)
    .option("-s, --strategy <string>", "simulation strategy")
    .option("-r, --rng <string>", "rng algorithm (isaac, mersenne-twister)", "isaac")
    .option("-l, --log", "log RNG calls", false)
    .option("-d, --dump <string>", "dump file", "dump.txt");

program.parse(process.argv);

// const startTime = new Date().getTime();
const options = program.opts();
const game = options["game"];
const iterations = options["iterations"];
const startingAction = options["startingAction"];
const initialAction = options["initialAction"] || startingAction;
const strategy = options["strategy"];
const bet = options["bet"];
const rngAlgorithm = options["rng"];
const log = options["log"];
const dump = options["dump"];
const currency = "eur";

const gamePath = path.resolve(process.cwd(), game);

tsNode.register({
    compilerOptions: {
        resolveJsonModule: true,
        module: "commonjs",
        moduleResolution: "node",
        allowJs: true,
        skipLibCheck: true,
    },
    transpileOnly: true,
});

import(gamePath).then(async value => {
    setTimeout(() => {
        const game: IGame = value.default;
        const bets = typeof game.bets === "function" ? game.bets() : game.bets;
        const coin = bets && bets[initialAction] && bets[initialAction].coin;

        console.info("Game path:", gamePath);
        console.info("Iterations:", iterations.toLocaleString().replace(/,/g, " "));
        console.info("Bet:", `${bet} ${currency} (${coin} coins)`);
        console.info("Initial action:", startingAction || "");
        console.info("Strategy:", strategy || "");
        console.info("RNG algorithm:", rngAlgorithm);
        console.info("");

        const rounds = [];
        for (let i = 1; i < iterations + 1; i++) {
            const wagers = [];
            let response: IPlayResponse | null = null;
            let request: IPlayRequest;

            // TODO: implement once stats is stable
            const action: string | null = startingAction as string;

            const numbers: number[] = [];
            const memorisingRandom = createMemorisingRandom(numbers);
            do {
                const config = game.config ? game.config() : {};
                //const params = game.params ? game.params(action, wagers, createRandom()) : undefined;
                request = {bet, action, state: response && response.state, coin, config};
                response = game.play(request, memorisingRandom, mockBetLimits);
                const wager = {...request, ...response};

                if (response.next && !game.action) throw new Error("Game action needs to be implemented");
                //action = response.next && game.action ? game.action(strategy, wager, memorisingRandom) : null;
                wagers.push(wager);
            } while (response.next && action);

            rounds.push({wagers, numbers});
        }
        saveDump(dump, rounds);
    }, 100);
});

function saveDump(dumpFile: string, rounds: any[]) {
    let balance = 100000;
    let str = "";
    for (let i = 0; i < rounds.length; i++) {
        str += `ROUND ${i + 1}\n`;
        if (log) {
            str += `RNG: ${rounds[i].numbers}\n`;
        }
        balance = round(balance - rounds[i].wagers[0].bet);
        for (let j = 0; j < rounds[i].wagers.length; j++) {
            const wager = rounds[i].wagers[j];
            const balanceAfter = round(balance + wager.win);
            str += `\tWAGER ${j + 1} (BALANCE BEFORE ${balance}; BALANCE AFTER ${balanceAfter}; BET ${wager.bet}; WIN: ${wager.win};)\n`;
            for (let k = 0; k < (wager.data && wager.data.length); k++) {
                const spin = wager.data[k];
                str += `\t\tSPIN ${k + 1} (WIN ${spin.win})\n`;

                str += `\t\t\t${printBoard(spin.board).replace(/\n/g, "\n\t\t\t")}`;
                str += "\n";
            }

            balance = balanceAfter;

            str += "\n";
        }
    }
    fs.writeFileSync(dumpFile, str);
    console.info(`Dump saved to ${dumpFile}`);
}

function printBoard(board: string[][]): string {
    let str = "";
    let maxColumn = 0;
    for (let column: number = 0; column < board.length; column++) {
        maxColumn = Math.max(maxColumn, board[column].length);
    }

    for (let row: number = 0; row < maxColumn; row++) {
        for (let column: number = 0; column < board.length; column++) {
            const symbol = board[column][row];
            str += chars(symbol, 10);
        }
        str += "\n";
    }
    return str;
}

function chars(_str: string, max: number = 10): string {
    let str = "";
    for (let i = 0; i < max; i++) {
        str += (_str || "").charAt(i) || " ";
    }
    return str;
}
