import {createService, startService} from "@slotify/shared/lib/api";
import {Express} from "express";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {body, check, query} from "express-validator";
import {DataSourceOptions} from "typeorm";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import auth from "@slotify/shared/lib/middleware/jwtAuth";
import authenticate, {IPlayer} from "./route/authenticate";
import {autoCompleteRound} from "./route/autoCompleteRound";
import complete from "./route/complete";
import info from "./route/info";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import play from "./route/play";
import history from "./route/history";
import resolvers from "./graphql/resolvers";
import {getChannel} from "@slotify/shared/lib/getChannel";
import {graphQLApi} from "@slotify/shared/lib/graphQLApi";
import {addResolversToSchema} from "@graphql-tools/schema";
import {loadSchema} from "@graphql-tools/load";
import {GraphQLFileLoader} from "@graphql-tools/graphql-file-loader";
import recover from "./route/recover";
import replay from "./route/replay";
import cheats from "./route/cheats";
import games from "./route/games";
import convertBet from "./route/convertBet";
import {getIp} from "@slotify/shared/lib/ip";
import evaluate from "./route/evaluate";
import {verifyBlockingCriticalFiles} from "./compliance/critical-files/blocking";
import {verifyCriticalFiles} from "./compliance/critical-files/verification";
import {initMail} from "@slotify/shared/lib/mail";
import feed from "./route/feed";
import closeRound from "./route/closeRound";
import logger from "@slotify/shared/lib/logger";
import walletMessage from "./route/walletMessage";
import {rooms} from "./multiplayer/rooms";
import {onConnected, onMessage, onSystemConnected, onSystemMessage} from "./multiplayer/websocket";
import {initTicks} from "./multiplayer/tick";
import {initRedis} from "@slotify/shared/lib/redis";
import proveFairness from "./route/proveFairness";
import {initScheduler} from "@slotify/shared/lib/scheduler";
import scheduledTasks from "./util/scheduledTasks";
import {currencyDecimals} from "./route/currencyDecimals";
import balance from "./route/balance";
import {currencyExchangeRates} from "./route/currencyExchangeRates";
import {initRgsMetrics} from "./util/metrics";
import {currencySymbols} from "./route/currencySymbols";

async function initApi(api: Express) {
    api.use(async (req, res, next) => {
        if (["/graphql", "/api/criticalFileChecksum", "/health", "/health/all", "/version", "/version/all"].includes(req.path)) return next();
        await verifyBlockingCriticalFiles();
        next();
    });

    api.post(
        "/authenticate",
        validate([
            body("wallet").isString().exists().isLength({max: 255}),
            body("operator").isString().exists().isLength({max: 255}),
            body("key")
                .isString()
                .exists()
                .isLength({max: 10 * 1024}),
            body("game").isString().optional().isLength({max: 255}),
        ]),
        async (req, res) => {
            const ip = getIp(req);
            const channel = getChannel(req.headers["user-agent"]);
            res.json(await authenticate(req.body.wallet, req.body.operator, req.body.key, req.body.provider, req.body.game, channel, ip, req.get("ip-blocked-country")));
        },
    );

    api.get("/balance", auth.verify("player"), validate([query("provider").isString().exists().isLength({max: 255}), query("game").isString().exists().isLength({max: 255})]), async (req, res) => {
        res.json(await balance(res.locals.user.playerId, req.query.provider as string, req.query.game as string));
    });

    api.post(
        "/game/play",
        auth.verify("player"),
        validate([
            body("game").isString().exists().isLength({max: 255}),
            body("provider").isString().exists().isLength({max: 255}),
            body("bet").optional().toFloat(),
            body("action").isString().isLength({max: 255}),
            body("roundId").optional({checkFalsy: true}).isUUID().isLowercase(),
            body("complete").optional(),
            body("cheat")
                .optional()
                .customSanitizer(cheat => (isDevMode() ? cheat : null))
                .isLength({max: 255 * 1000}),
        ]),
        async (req, res) => {
            const channel = getChannel(req.headers["user-agent"]);
            const {provider, game, roundId, bet, action, params, cheat, complete, asyncWin} = req.body;
            const ip = getIp(req);
            res.json(await play(res.locals.user, provider, game, roundId, bet, action, params, cheat, channel, ip, complete, asyncWin));
        },
    );

    api.post(
        "/game/complete",
        auth.verify("player"),
        validate([body("game").isString().exists().isLength({max: 255}), body("provider").isString().exists().isLength({max: 255}), body("roundId").isUUID().isLowercase().exists()]),
        async (req, res) => {
            const {roundId, asyncWin} = req.body;
            const channel = getChannel(req.headers["user-agent"]);
            const ip = getIp(req);
            res.json(await complete(res.locals.user, roundId, asyncWin, channel, ip, false, 0));
        },
    );

    api.all("/game/info", auth.verify("player"), validate([check("game").isString().exists().isLength({max: 255}), check("provider").isString().exists().isLength({max: 255})]), async (req, res) => {
        const {playerId, wallet, operator, brand, currency, jurisdiction, sessionId} = res.locals.user;
        const {provider, game, roomId} = {...req.query, ...req.body} as Record<string, string>; //we need to support it in both GET and POST
        res.json(await info(provider, game, playerId, currency, wallet, operator, brand, jurisdiction, sessionId, roomId));
    });

    api.post("/game/recover", auth.verify("player"), validate([body("game").isString().exists().isLength({max: 255}), body("provider").isString().exists().isLength({max: 255})]), async (req, res) => {
        const {provider, game, complete} = req.body;
        const channel = getChannel(req.headers["user-agent"]);
        const ip = getIp(req);
        res.json(await recover(res.locals.user, provider, game, channel, ip, complete));
    });

    api.get("/game/replay", validate([query("roundId").isUUID().exists()]), async (req, res) => {
        const {roundId} = req.query as Record<string, string>;
        res.json(await replay(roundId));
    });

    api.get("/game/history", auth.verify("player"), validate([query("game").isString().exists().isLength({max: 255}), query("provider").isString().exists().isLength({max: 255})]), async (req, res) => {
        const {playerId} = res.locals.user;
        const {provider, game, page} = req.query as Record<string, string>;
        res.json(await history(parseInt(page, 10), provider, game, playerId));
    });

    api.post("/walletMessage", auth.verify("player"), validate([body("game").isString().exists().isLength({max: 255}), body("provider").isString().exists().isLength({max: 255}), body("data").isObject().exists()]), async (req, res) => {
        const {playerId} = res.locals.user;
        const {provider, game, data} = req.body;
        res.json(await walletMessage(provider, game, playerId, data));
    });

    api.get("/game/feed", validate([query("game").isString().exists().isLength({max: 255}), query("amount").isInt({min: 1, max: 1000}).exists()]), async (req, res) => {
        const {game, amount} = req.query as Record<string, any>;
        res.json(await feed(game, amount));
    });

    api.get("/game/cheats", validate([query("game").isString().exists().isLength({max: 255})]), async (req, res, next) => {
        if (!isDevMode()) return next();
        const {provider, game} = req.query as Record<string, string>;
        res.json(await cheats(provider, game));
    });

    api.get("/games", async (req, res) => {
        res.json(await games());
    });

    api.get("/currencyDecimals", async (req, res) => {
        res.json(await currencyDecimals());
    });

    api.get("/currencySymbols", async (req, res) => {
        res.json(await currencySymbols());
    });

    api.get("/currencyExchangeRates", async (req, res) => {
        res.json(await currencyExchangeRates());
    });

    api.get("/game/rooms", auth.verify("player"), validate([query("provider").isString().exists().isLength({max: 255}), query("game").isString().exists().isLength({max: 255})]), async (req, res) => {
        const {provider, game} = req.query as Record<string, any>;
        const {currency, wallet, operator, brand, jurisdiction} = res.locals.user as IPlayer;
        res.json(await rooms(provider, game, currency, wallet, operator, brand, jurisdiction));
    });

    api.get(
        "/game/proveFairness",
        validate([
            query("game").isString().exists().isLength({max: 255}),
            query("serverSeed").isString().optional().isLength({max: 64}),
            query("clientSeed").isString().optional().isLength({max: 64}),
            query("nonce").isInt().optional(),
            query("hash").isString().optional().isLength({max: 64}),
            query("seed").isString().optional().isLength({max: 64}),
            query("data").isString().optional().isLength({max: 2048}),
        ]),
        async (req, res) => {
            const {provider, game, serverSeed, clientSeed, nonce, hash, seed, data} = req.query as Record<string, any>;
            res.json(await proveFairness(provider, game, {serverSeed, clientSeed, nonce, hash, seed}, data));
        },
    );

    //internal

    api.post("/api/websocket/connected", validate([body("channel").isString().exists(), body("player").isObject().exists()]), async (req, res) => {
        const {channel, player} = req.body;
        await onConnected(channel, player);
        res.json({success: true});
    });

    api.post("/api/websocket/message", validate([body("channel").isString().exists(), body("player").isObject().exists(), body("message").isObject().exists()]), async (req, res) => {
        const {channel, player, message} = req.body;
        await onMessage(channel, player, message);
        res.json({success: true});
    });

    api.post("/api/websocket/systemConnected", validate([body("channel").isString().exists(), body("systemId").isString().exists(), body("signature").isString().exists()]), async (req, res) => {
        const {channel, systemId, signature} = req.body;
        await onSystemConnected(channel, systemId, signature);
        res.json({success: true});
    });

    api.post("/api/websocket/systemMessage", validate([body("channel").isString().exists(), body("systemId").isString().exists(), body("signature").isString().exists(), body("message").isString().exists()]), async (req, res) => {
        const {channel, systemId, message, signature} = req.body;
        await onSystemMessage(channel, systemId, message, signature);
        res.json({success: true});
    });

    api.use(
        "/graphql",
        graphQLApi(
            addResolversToSchema({
                schema: await loadSchema(process.cwd() + "/graphql/schema.graphql", {loaders: [new GraphQLFileLoader()]}),
                resolvers,
            }),
        ),
    );

    api.get(
        "/api/convertBet",
        validate([
            query("amount").isNumeric().exists().isLength({max: 255}),
            query("currencyFrom").isString().exists().isLength({max: 255}),
            query("currencyTo").isString().exists().isLength({max: 255}),
            query("provider").isString().optional().isLength({max: 255}),
            query("game").isString().exists().isLength({max: 255}),
            query("wallet").isString().optional().isLength({max: 255}),
            query("operator").isString().optional().isLength({max: 255}),
            query("brand").isString().optional({nullable: true}).isLength({max: 255}),
            query("jurisdiction").isString().optional({nullable: true}).isLength({max: 255}),
        ]),
        async (req, res) => {
            const {amount, currencyFrom, currencyTo, provider, game, wallet, operator, brand, jurisdiction} = req.query as Record<string, string>;
            const converted = await convertBet(parseFloat(amount), currencyFrom, currencyTo, provider, game, wallet, operator, brand, jurisdiction);
            res.json({converted});
        },
    );

    api.post("/api/evaluate", validate([body("type").isString().exists().isLength({max: 255}), body("data").optional(), body("roundId").isUUID().exists()]), async (req, res) => {
        const {type, roundId, data} = req.body;

        res.json(await evaluate(type, data, roundId));
    });

    api.post("/api/closeRound", validate([body("roundId").isUUID().exists(), body("status").isString().exists()]), async (req, res) => {
        const roundId = req.body.roundId;
        const status = req.body.status;
        res.json(await closeRound(roundId, status));
    });

    api.post("/api/autoCompleteRound", validate([body("roundId").isUUID().exists()]), async (req, res) => {
        const roundId = req.body.roundId;
        await autoCompleteRound(roundId);
        res.json({roundId});
    });
}

async function init() {
    const {api} = await createService("rgs");
    await createConnections({
        replica: {...dbOptions("rgs"), host: process.env.REPLICA_DB_HOST, port: process.env.REPLICA_DB_PORT || process.env.DB_PORT, synchronize: false, migrationsRun: false, installExtensions: false} as DataSourceOptions,
        primary: {...dbOptions("rgs")},
    });
    await initApi(api);
    initMail();

    await initRedis("rgs");
    initScheduler(30);
    await initTicks();
    await scheduledTasks();
    initRgsMetrics();

    const server = await startService(api);
    await verifyCriticalFiles().catch(error => logger.error(error));
    return {api, server};
}

export default init();
