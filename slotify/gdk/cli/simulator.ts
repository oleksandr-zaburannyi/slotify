import * as tsNode from "ts-node";
import cluster from "node:cluster";
import {Command, OptionValues, program} from "commander";
import os from "os";
import path from "path";
import {IGame, IWager} from "../IGame";
import {IMultiplayerGame, ITick} from "../IMultiplayerGame";
import sum from "@slotify/shared/lib/sum";
import Stats from "../stats/Stats";
import {ProcessEnv} from "npm-run-path";

async function getChalk() {
    const mod = await eval('import("chalk")');
    return mod.default;
}

type IWorkers = Record<
    number,
    {
        stats: any;
        iterations: number;
        finished?: boolean;
    }
>;
type IRun<IRunData, TStatsData> = {
    runData: IRunData;
    statsData: TStatsData[];
};

export function simulator<TGame = IGame | IMultiplayerGame, TStatsData = ITick | IWager, IRunData = any, TInitData = any>(
    name: string,
    commands: (command: Command) => void,
    print: (game: TGame, options: OptionValues) => Record<string, string>,
    init: (env: ProcessEnv, game: TGame) => Promise<TInitData>,
    asyncRun: boolean,
    run: (initData: TInitData, response: IRunData | null, game: TGame) => Promise<IRun<IRunData, TStatsData>> | IRun<IRunData, TStatsData>,
    stats: (game: TGame) => Record<string, Stats>,
    statsProcess: (stat: Stats, statsData: TStatsData[]) => void,
) {
    tsNode.register({
        compilerOptions: {
            resolveJsonModule: true,
            module: "commonjs",
            moduleResolution: "node",
            allowJs: true,
            skipLibCheck: true,
            jsx: "react",
        },
        transpileOnly: true,
    });

    if (cluster.isPrimary) {
        if (process.argv.length === 2) {
            process.argv.push("--help");
        }
        const command = program.name(name);
        command
            .requiredOption("-g, --game <string>", "path to the game (required)")
            .option("-i, --iterations <number>", "number of iterations to simulate", parseIterations, 1000000)
            .option("-r, --rngAlgorithm <string>", "rng algorithm (isaac, mersenne-twister)", "isaac")
            .option("-c, --cores <number>", "number of cores", os.cpus().length.toString())
            .option("--refreshInterval <number>", "stats live refreshing inverval in seconds (0 to turn off)", parseFloat, 1);

        commands(command);

        program.parse(process.argv);
        const options = program.opts();
        const startTime = new Date().getTime();
        const game = options["game"];
        const iterations = options["iterations"];
        const cpuCount = options["cores"];
        const rngAlgorithm = options["rngAlgorithm"];
        const refreshInterval = options["refreshInterval"];

        const gamePath = path.resolve(process.cwd(), game);
        import(gamePath).then(async value => {
            const game: TGame = value.default;

            if (process.stdout.isTTY) {
                await printValue("Game path", gamePath);
                await printValue("Cores", cpuCount);
                await printValue("RNG algorithm", rngAlgorithm);
                await printValue("Iterations", iterations.toLocaleString().replace(/,/g, " "));

                for (const [name, value] of Object.entries(print(game as any, options))) {
                    await printValue(name, value);
                }
                console.info("");
            }

            const workers: IWorkers = {};
            cluster.on("fork", function (worker) {
                workers[worker.id] = {stats: {}, iterations: 0};
            });

            cluster.on("message", function (worker, message) {
                if (message.type === "progress") {
                    workers[worker.id] = {stats: message.stats, iterations: message.iterations};
                }
            });

            if (process.stdout.isTTY && refreshInterval > 0) {
                setInterval(async () => {
                    await printResults(iterations, workers, startTime, game);
                }, refreshInterval * 1000);
            }

            cluster.on("exit", async function (worker) {
                workers[worker.id].finished = true;
                if (Object.values(workers).every(worker => worker.finished)) {
                    if (process.stdout.isTTY) {
                        await printResults(iterations, workers, startTime, game);
                    } else {
                        outputJson(stats, game, workers);
                    }
                    process.exit();
                }
            });

            const env = {
                gamePath,
                refreshInterval,
                workerIterations: Math.ceil(iterations / cpuCount),
                RNG_ALGORITHM: rngAlgorithm,
                ...options,
            };
            for (let i = 0; i < cpuCount; i += 1) {
                cluster.fork(env);
            }
        });
    } else {
        const {gamePath, workerIterations, refreshInterval} = process.env;
        import(gamePath as string).then(async game => {
            const iterationsNumber = parseInt(workerIterations as string, 10);
            const initData = await init(process.env, game.default);
            let response: IRunData | null = null;
            let lastTime = Date.now();
            for (let i = 1; i < iterationsNumber + 1; i++) {
                //checking for promise is done to avoid performance degradation in single player where it's not needed
                const runData: IRun<IRunData, TStatsData> = asyncRun ? await run(initData, response, game.default) : (run(initData, response, game.default) as IRun<IRunData, TStatsData>);
                response = runData.runData;
                for (const stat of Object.values(stats(game.default))) {
                    statsProcess(stat, runData.statsData as any);
                }

                if (Date.now() - lastTime >= parseFloat(refreshInterval!) * 1000 || i === iterationsNumber) {
                    lastTime = Date.now();
                    const data: Record<string, any> = {};
                    for (const [key, stat] of Object.entries(stats(game.default))) {
                        data[key] = stat.mapResults();
                    }
                    process.send?.({type: "progress", iterations: i, stats: data});
                }
            }
            setTimeout(() => process.exit(), 1000);
        });
    }

    function parseIterations(value: string): number {
        const multipliers: Record<string, number> = {"k": 1000, "m": 1000000, "b": 1000000000};
        const lastChar = value.charAt(value.length - 1).toLowerCase();
        return parseFloat(value.substring(0, value.length)) * (multipliers[lastChar] || 1);
    }

    let lines = 0;

    async function printValue(name: string, value: string) {
        const chalk = await getChalk();
        console.info(chalk.grey(name) + ": " + chalk.blue.italic(value));
        lines += value.split("\n").length;
    }

    async function printResults(totalIterations: number, workers: IWorkers, startTime: number, game: TGame) {
        const chalk = await getChalk();
        chalk.reset();
        process.stdout.moveCursor(0, -lines);
        process.stdout.clearScreenDown();
        lines = 0;

        const timeDiff = new Date(new Date().getTime() - startTime);
        const iterations = sum(Object.values(Object.values(workers).map(worker => worker.iterations)));
        await printValue("Execution time", timeDiff.toUTCString().split(" ")[4]);
        await printValue("Progress", `${((iterations / totalIterations) * 100).toFixed(0)}% (${iterations.toLocaleString().replace(/,/g, " ")})`);

        for (const [name, stat] of Object.entries(stats(game))) {
            stat.clearResults();
            for (const worker of Object.values(workers)) {
                const results = worker.stats[name];
                if (results) {
                    stat.reduceResults(results);
                }
            }
            await printValue(`${name}`, `${iterations > 0 ? stat.message() : "-"}`);
        }
    }

    function outputJson<TGame>(stats: (game: TGame) => Record<string, Stats>, game: TGame, workers: IWorkers) {
        const json: Record<string, any> = {};
        for (const [name, stat] of Object.entries(stats(game))) {
            stat.clearResults();
            for (const worker of Object.values(workers)) {
                const results = worker.stats[name];
                if (results) {
                    stat.reduceResults(results);
                }
            }
            json[name] = stat.value();
        }
        console.info(JSON.stringify(json));
    }
}
