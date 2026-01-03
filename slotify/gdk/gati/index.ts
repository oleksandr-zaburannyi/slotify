import {createService, startService} from "@slotify/shared/lib/api";
import Exception from "@slotify/shared/lib/Exception";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import logger from "@slotify/shared/lib/logger";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {round} from "@slotify/shared/lib/round";
import * as fs from "fs";
import {sha1FileSync} from "sha1-file";
import morgan from "morgan";
import morganBody from "morgan-body";
import {getGame, getGames, initGames} from "../game";
import {IGame, IWager} from "../IGame";
import {Express, NextFunction, Request, Response} from "express";
import * as os from "os";
import {createGatiRng, loadRngNumbers} from "./createGatiRng";
import {mockBetLimits} from "../helper/mockBetLimits";

export interface IGatiGame<IObjectiveData = any, IObjectiveState = any> {
    gati: {
        id: string;
        objectives?: IBoostObjective<IObjectiveData, IObjectiveState>[];
        boostState?: (wager: IWager) => IObjectiveState;
        objectivesData?: (wager: IWager) => IObjectiveData;
    };
}

export interface IBoostObjective<IObjectiveData = any, IObjectiveState = any> {
    id: string;
    description: string;
    goal: number;
    period: number;
    evaluate: (data: IObjectiveData[], state: IObjectiveState) => {progress: number; state?: IObjectiveState};
}

async function initApi(api: Express) {
    if (isDevMode()) {
        morganBody(api, {prettify: false});
        api.use(morgan("combined"));
    }

    api.disable("etag");

    const getGatiGame = (id: string): IGame & IGatiGame => {
        const game = getGames()
            .map(game => getGame(game) as IGame & IGatiGame)
            .find(game => game.gati && game.gati.id === id);

        if (!game) {
            throw new Exception(`Couldn't find game with Gati Id '${id}'`);
        }
        return game as IGame & IGatiGame;
    };

    // const randomElement = (items: any[]): any => {
    //     return items[Math.floor(Math.random() * items.length)];
    // };
    //
    // api.post("/v2/games/:game/rtptest", async (req, res) => {
    //     const {randomNumbers, betAmount, mode, strategy} = req.body;
    //     logger.info("Running RTP test: ", {betAmount, mode, strategy});
    //     let totalSpinsAmount = 0;
    //     let winSpinsAmount = 0;
    //     let totalBetAmount = 0;
    //     let totalWinAmount = 0;
    //     let totalWinSquaredAmount = 0;
    //
    //     const game = getGatiGame(req.params.game);
    //     const startingAction = mode || "main";
    //     const initialAction = mode || "main";
    //     const coin = game.bets[initialAction].coin;
    //     const config = game.config ? game.config() : {};
    //     const rng = getRNG() as IGatiRNG;
    //
    //     rng.init(0, 0);
    //     rng.clearLog();
    //     rng.setNumbers(randomNumbers);
    //
    //     for (const name in game.stats) {
    //         game.stats[name].clearResults();
    //     }
    //
    //     while (rng.getNumbers().length >= 10000) {
    //         const wagers = [];
    //         let win = 0;
    //         let response: IPlayResponse | null = null;
    //         let request: IPlayRequest;
    //         let action: string | null = startingAction;
    //         do {
    //             request = {config, bet: betAmount, action, params: null, state: response && response.state, coin};
    //             response = game.play(request);
    //             const wager = {...request, ...response};
    //             if (response.next) {
    //                 if (!game.action) throw new Error("Game action needs to be implemented");
    //                 action = strategy ? game.action(strategy, wager) : randomElement(response.next);
    //             } else {
    //                 action = null;
    //             }
    //             win += response.win;
    //             wagers.push(wager);
    //         } while (response.next && action);
    //
    //         totalSpinsAmount++;
    //         winSpinsAmount += win > 0 ? 1 : 0;
    //         totalBetAmount += betAmount;
    //         totalWinAmount += win;
    //         totalWinSquaredAmount += Math.pow(win, 2);
    //
    //         for (const name in game.stats) {
    //             game.stats[name].processAllWagers(wagers);
    //         }
    //     }
    //
    //     const stats: Record<string, any> = {};
    //     for (const i in game.stats) {
    //         stats[i] = game.stats[i].mapResults();
    //     }
    //
    //     res.json({totalSpinsAmount, winSpinsAmount, totalBetAmount, totalWinAmount, totalWinSquaredAmount, stats});
    // });

    api.post("/v2/games/:game/rtptotal", async (req, res) => {
        const {rtpTestResults} = req.body;
        const game = getGatiGame(req.params.game);
        const stats: Record<string, string> = {};
        for (const i in game.stats) {
            game.stats[i].clearResults();
            for (const results of rtpTestResults) {
                game.stats[i].reduceResults(results.stats[i]);
            }
            stats[i] = game.stats[i].message();
        }

        res.json({...stats});
    });

    api.post("/v2/games/:game/checksum", async (req, res) => {
        const checksums = req.body.map(({id, name, location}: {id: string; name: string; location: string}) => {
            const checksum = sha1FileSync(`${location}/${name}`);
            return {id, checksum};
        });
        res.json(checksums);
    });

    api.get("/v2/games/:game/version", async (req, res) => {
        const file = fs.readFileSync("gati.json").toString();
        const data = JSON.parse(file);

        res.json({
            "buildChecksum": "string",
            "buildTime": "string",
            "vcsVersion": "string",
            "gameTitle": data.gameTitle,
            "gameVersion": data.version,
            "vendor": data.provider,
        });
    });

    api.get("/v2/games/:game/initialize", async (req, res) => {
        res.json({playerStatePrivate: {}, playerStatePublic: {}});
    });

    api.post("/v2/games/:game/validate", async (req, res) => {
        res.json({validationErrors: []});
    });

    api.get("/v2/games/:game/config", (req, res) => {
        const game = getGatiGame(req.params.game);
        const variant = req.header("X-Rtp-Variant");
        res.json({coinsPerBet: Object.values(game.bets).map(bet => bet.coin), ...removeUnderscoredKeys(game.config ? game.config(variant) : {})});
    });

    api.get("/v2/games/:game/objectives", (req, res) => {
        const game = getGatiGame(req.params.game);
        const objectives = ((game.gati && game.gati.objectives) || []).map(({id, description, goal, period}) => {
            return {id, description, goal, period};
        });
        res.json(objectives);
    });

    api.post("/v2/games/:game/evaluate/:objectiveId", (req, res) => {
        const objectiveId = req.params.objectiveId;
        const state = req.body.state;
        const boostData: any[] = req.body.boostData;
        const game = getGatiGame(req.params.game);
        const objective = (game.gati.objectives || []).find(objective => objective.id === objectiveId);
        res.json(objective?.evaluate(boostData, state));
    });

    api.post("/v2/games/:game/play", async (req, res) => {
        const game = getGatiGame(req.params.game);
        const variant = req.header("X-Rtp-Variant");
        const action: string = req.body.command || "main";
        const state: any = req.body.playerState && req.body.playerState.playerStatePrivate;
        const params: any = req.body.clientParams;
        const bet: number = req.body.stakeValue.cashBet;
        const coinBet: number = req.body.stakeValue.coinBet;
        const coin = round(bet / coinBet);
        const cheat: string = req.body.cheat;
        const config = game.config ? game.config() : {};
        // const cheatFunc = game.cheats && game.cheats[action] && game.cheats[action][cheat];
        // const cheatRNGSequence = (cheat && cheat.indexOf("rng:") === 0 && cheat.substring("rng:".length).split(",").map(parseFloat)) || null;

        let simulations = 0;
        const maxSimulations = 500000;
        let request;
        let wager = null;
        let response = null;
        const rng = await createGatiRng({game, cheat, action});
        do {
            if (++simulations >= maxSimulations) throw new Exception(`Couldn't satisfy cheat ${cheat} in ${maxSimulations} simulations`);
            request = {bet, state, action, params, coin, config, variant};

            // const startTime = new Date().getTime();
            // const numbersBeforeFetch = rng.getNumbers().length;
            // try {
            //     await singleExecution(async () => {
            //         await rng.beforePlay(cheatRNGSequence);
            //     });
            // } catch (e) {
            //     // throw new Error("Couldn't fetch RNG numbers");
            // }
            // const numbersAfterFetch = rng.getNumbers().length;
            // const fetchTime = new Date().getTime() - startTime;
            response = game.play(request, rng.random, mockBetLimits);
            // const playTime = new Date().getTime() - startTime;
            // const numbersAfterPlay = rng.getNumbers().length;
            // const {rss} = process.memoryUsage();

            // logger.info(
            //     `play: action=${action}, bet=${bet}, variant=${variant}, beforeFetch=${numbersBeforeFetch}, afterFetch=${numbersAfterFetch}, fetchTime=${fetchTime}ms, afterPlay=${numbersAfterPlay}, used=${numbersAfterFetch - numbersAfterPlay}, playTime=${playTime}, rss=${formatMemoryUsage(rss)}`,
            // );
            wager = {...request, ...response};
        } while (!rng.acceptsWager(wager));

        const boostData = game.gati && game.gati.objectivesData && game.gati.objectivesData(wager);
        const data = Array.isArray(response.data) ? response.data : [{win: response.win}];
        const results = data.map(({win, ...clientData}) => {
            return {cashWin: win, coinWin: Math.round(win / coinBet), clientData};
        });
        const randomNumbers = rng.getNumbers().map(bits => {
            const range = 1000;
            return {bits, range, value: bits % range};
        });

        res.json({
            finished: !response.next || response.next.length === 0,
            randomNumbers,
            playerState: {
                playerStatePrivate: response.state,
                playerStatePublic: removeUnderscoredKeys(response.state || {}),
            },
            jackpotData: null,
            results,
            nextCommands: response.next,
            boostData,
        });
    });

    api.use((err: Exception, req: Request, res: Response, next: NextFunction) => {
        if (!err) next();
        logger.error(err);
        res.status(500).json({error: err.message, code: err?.code});
    });
}

// async function iniRNG() {
// const gameId = fs.existsSync("gati.json") ? JSON.parse(fs.readFileSync("gati.json").toString()).gameId : "1";
// const rng = getRNG() as IGatiRNG;
// rng.setGame(gameId);
// const startTime = new Date().getTime();
// const rngPool = process.env.RNG_POOL ? parseInt(process.env.RNG_POOL, 10) : 20000;
// const rngLimit = process.env.RNG_LIMIT ? parseInt(process.env.RNG_LIMIT, 10) : 1000;
// await loadRngNumbers();
// try {
// await rng.beforePlay();
// logger.info(`RNG initialized in ${new Date().getTime() - startTime}ms`);
// } catch (e) {
//     logger.info("RNG initialization failed");
// }
// }

const formatMemoryUsage = (data: number) => `${Math.round((data / 1024 / 1024) * 100) / 100} MB`;

async function init() {
    try {
        const data = JSON.parse(fs.readFileSync("gati.json").toString());
        const pack = JSON.parse(fs.readFileSync("package.json").toString());
        console.info(`Initializing server: ${data.gameTitle} ${data.version}, gdk: ${pack.dependencies["@slotify/gdk"]}`);
    } catch {
        console.info("Couldn't find gati.json file");
    }
    console.info(`Total memory: ${formatMemoryUsage(os.totalmem())}, free memory: ${formatMemoryUsage(os.freemem())}`);

    const {api} = await createService("gati", "1000mb");
    await initGames();
    await loadRngNumbers();
    await initApi(api);
    const server = await startService(api, 2004);
    return {api, server};
}

export default init();
