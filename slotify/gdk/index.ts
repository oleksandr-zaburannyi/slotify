import {createService, startService} from "@slotify/shared/lib/api";
import Exception from "@slotify/shared/lib/Exception";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {body, param, query} from "express-validator";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {getGame, getGames, initGames} from "./game";
import {IGame, IPlayRequest, IPlayResponse, IWager} from "./IGame";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import * as express from "express";
import {IMultiplayerGame} from "./IMultiplayerGame";
import {createRandom} from "@slotify/rng/lib/random/factory";
import {createMultiplayerRng, createRng} from "./helper/createRng";
import {createMultiplayerProofBuilder, createProofBuilder} from "@slotify/rng/lib/random/createProofBuilder";
import {initServices} from "./services";

async function initApi(api: express.Express) {
    if (process.env.STATIC_DIR) {
        api.use("/", express.static(process.cwd() + "/" + process.env.STATIC_DIR));
    }

    api.get("/api/games", validate([]), (req, res) => {
        res.json({[process.env.PROVIDER!]: getGames()});
    });

    api.get("/api/games/:game/cheats", validate([param("game").isString().exists()]), async (req, res) => {
        const {cheats} = getGame(req.params.game) as IGame;
        const cheatsMap: Record<string, string[]> = {};
        for (const action in cheats) {
            cheatsMap[action] = Object.keys(cheats[action]);
        }
        res.json(cheatsMap);
    });

    api.get("/api/games/:game/config", validate([param("game").isString().exists(), param("variant").optional({nullable: true}).isString()]), async (req, res) => {
        const game = getGame(req.params.game);
        const variant = req.query.variant === "" ? undefined : (req.query.variant as string);
        res.json(removeUnderscoredKeys(game.config ? game.config(variant) : {}));
    });

    api.get("/api/games/:game/bets", validate([param("game").isString().exists(), param("variant").optional({nullable: true}).isString()]), async (req, res) => {
        const game = getGame(req.params.game);
        const variant = req.query.variant === "" ? undefined : (req.query.variant as string);
        const bets = typeof game.bets === "function" ? game.bets(variant) : game.bets;
        res.json({bets});
    });

    api.post(
        "/api/games/:game/validate",
        validate([
            param("game").isString().exists(),
            body("betLimits").optional(),
            body("bet").toFloat(),
            body("sideBet").optional().toFloat(),
            body("coin").toFloat(),
            body("action").isString(),
            body("params").optional(),
            body("state").optional(),
            body("variant").optional(),
        ]),
        async (req, res) => {
            const game = getGame(req.params.game) as IGame;
            const {bet, sideBet, coin, action, params, state, variant, betLimits} = req.body;
            const config = game.config ? game.config(variant) : {};
            const request = {bet, sideBet, coin, action, params, state, variant, config};
            res.json({valid: game.validate ? game.validate(request, betLimits) : false});
        },
    );

    api.post(
        "/api/games/:game/play",
        validate([
            param("game").isString().exists(),
            body("bet").optional().toFloat(),
            body("sideBet").optional().toFloat(),
            body("action").isString(),
            body("cheat")
                .optional()
                .customSanitizer(cheat => (isDevMode() ? cheat : null)),
            body("params").optional(),
            body("promo").optional(),
            body("state").optional(),
            body("variant").optional(),
            body("coin").optional().toFloat(),
            body("roundRngState").optional(),
            body("betLimits").optional(),
        ]),
        async (req, res) => {
            const game = getGame(req.params.game) as IGame;
            const {params, action, bet, sideBet, state, coin, cheat, variant, roundRngState, betLimits, promo} = req.body;
            const immutableState: any = JSON.stringify(state) || null;

            const rng = createRng({
                game,
                action,
                roundRngState,
                cheat: isDevMode() ? cheat : undefined,
            });

            const config = game.config ? game.config(variant) : {};

            let wager: IWager;
            let response: IPlayResponse;
            let simulations = 0;
            const maxSimulations = 500000;
            do {
                if (++simulations >= maxSimulations) throw new Exception(`Couldn't satisfy cheat ${cheat} in ${maxSimulations} simulations`);
                const request: IPlayRequest = {bet, sideBet, action, params, state: JSON.parse(immutableState), coin, config, variant, promo};
                response = game.play(request, rng.random, betLimits);
                wager = {...request, ...response};
            } while (!rng.acceptsWager(wager));

            const rngPayload = rng.getPayload();

            res.json({...response, rngPayload});
        },
    );

    api.post("/api/games/:game/action", validate([param("game").isString().exists()]), async (req, res) => {
        const game = getGame(req.params.game) as IGame;
        const wager: IWager = req.body;

        wager.config = game.config ? game.config(wager.variant) : {};

        const response = {
            action: wager.next![0],
        };

        if (game.action) {
            Object.assign(response, game.action(wager, createRandom()));
        }

        res.json(response);
    });

    api.post("/api/games/:game/evaluate", validate([param("game").isString().exists(), body("wagers").optional({nullable: true}), body("type").isString().exists(), body("data").optional()]), async (req, res) => {
        const game = getGame(req.params.game) as IGame | IMultiplayerGame;
        const {wagers, draw, type, data} = req.body;
        const result = game.evaluate ? game.evaluate(type, wagers || draw, data) : null;

        res.json({...result});
    });

    api.get(
        "/api/games/:game/proveFairness",
        validate([
            param("game").isString().exists(),
            query("serverSeed").isString().optional().isLength({max: 64}),
            query("clientSeed").isString().optional().isLength({max: 64}),
            query("nonce").isInt().optional(),
            query("hash").isString().optional().isLength({max: 64}),
            query("seed").isString().optional().isLength({max: 64}),
            query("data").isString().optional().isLength({max: 2048}),
        ]),
        async (req, res) => {
            const game = getGame(req.params.game) as IGame | IMultiplayerGame;

            if (!game.proveFairness) throw new Exception("Game doesn't support fairness proving", {data: {game}});

            const {serverSeed, clientSeed, nonce, hash, seed, data} = req.query as Record<string, any>;

            let proofBuilder;
            if (serverSeed && clientSeed && nonce != null) {
                proofBuilder = createProofBuilder({serverSeed, clientSeed, nonce});
                game.proveFairness(proofBuilder.addRandomization, data && JSON.parse(data));
            } else {
                proofBuilder = createMultiplayerProofBuilder({hash, seed});
                game.proveFairness(proofBuilder.addRandomization, data && JSON.parse(data));
            }

            res.json(proofBuilder.build());
        },
    );

    api.post("/api/multiplayer/:game/connected", validate([param("game").isString().exists(), body("state").exists(), body("playerId").isString().exists()]), async (req, res) => {
        const {state, time, playerId} = req.body;
        const game = getGame(req.params.game) as IMultiplayerGame;
        const response = game.connected ? game.connected({state, time, playerId}) : {};
        res.json(response);
    });

    api.post("/api/multiplayer/:game/systemConnected", validate([param("game").isString().exists(), body("state").exists(), body("systemId").isString().exists()]), async (req, res) => {
        const {state, time, systemId} = req.body;
        const game = getGame(req.params.game) as IMultiplayerGame;
        const response = game.systemConnected ? game.systemConnected({state, time, systemId}) : {};
        res.json(response);
    });

    api.post("/api/multiplayer/:game/init", validate([param("game").isString().exists(), body("time").isInt().exists(), body("config").optional()]), async (req, res) => {
        const game = getGame(req.params.game) as IMultiplayerGame;
        if (!game.init) throw new Exception(`Game ${req.params.game} doesn't seem to support multiplayer mode`);

        const {time, roomId, config} = req.body;
        const response = await game.init({time, roomId, config}, createRandom());

        res.json({...response});
    });

    api.post(
        "/api/multiplayer/:game/command",
        validate([
            param("game").isString().exists(),
            body("config").exists(),
            body("state").exists(),
            body("betLimits").optional(),
            body("playerId").isString().exists(),
            body("action").isString().exists(),
            body("bet").optional().toFloat(),
            body("params").optional(),
            body("time").isInt().exists(),
        ]),
        async (req, res) => {
            const game = getGame(req.params.game) as IMultiplayerGame;
            const response = game.command(req.body);
            res.json(response);
        },
    );

    api.post(
        "/api/multiplayer/:game/systemCommand",
        validate([param("game").isString().exists(), body("state").exists(), body("systemId").isString().exists(), body("action").isString().exists(), body("params").isObject().optional(), body("time").isInt().exists()]),
        async (req, res) => {
            const game = getGame(req.params.game) as IMultiplayerGame;

            if (typeof game.systemCommand !== "function") {
                throw new Exception(`Game ${req.params.game} doesn't seem to system commands`, {data: req.body});
            } else {
                const response = game.systemCommand(req.body);
                res.json(response);
            }
        },
    );

    api.post("/api/multiplayer/:game/cheat", validate([body("cheat").exists(), body("params").optional(), body("state").exists()]), async (req, res) => {
        const game = getGame(req.params.game) as IMultiplayerGame;
        const {cheat, params, state} = req.body;
        if (isDevMode()) {
            const response = game.cheat ? game.cheat(cheat, params, state) : {};
            res.json(response);
        } else {
            res.json({});
        }
    });

    api.post(
        "/api/multiplayer/:game/tick",
        validate([body("commands").exists(), body("config").exists(), body("state").exists(), body("time").isInt().exists(), body("drawId").isString().exists(), body("rngState").optional()]),
        async (req, res) => {
            const game = getGame(req.params.game) as IMultiplayerGame;

            const {rngState, ...request} = req.body;

            const rng = createMultiplayerRng(rngState);

            const response = await game.tick(request, rng.random);

            const rngPayload = rng.getPayload();

            res.json({...response, rngPayload});
        },
    );

    api.post("/api/multiplayer/:game/replay", validate([body("state").exists(), body("playerId").isString().optional()]), async (req, res) => {
        const game = getGame(req.params.game) as IMultiplayerGame;
        const response = game.replay ? game.replay(req.body.state, req.body.playerId) : {};
        res.json(response);
    });
}

async function init() {
    const {api} = await createService("games", "10mb");
    await initGames();
    await initServices(api);
    await initApi(api);
    const server = await startService(api);
    return {api, server};
}

export default init();
