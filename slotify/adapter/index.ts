import {createService, startService} from "@slotify/shared/lib/api";
import {body, check, param} from "express-validator";
import {DataSourceOptions} from "typeorm";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {initRgsApi} from "./rgsAdapter/rgsAdapter";
import {Express} from "express";
import {graphQLApi} from "@slotify/shared/lib/graphQLApi";
import {getSchemas} from "./graphql/getSchemas";
import {jwtAuth} from "./middleware/jwtAuth";
import currencies from "./route/currencies";
import {auditLog} from "./middleware/auditLog";
import {initWalletApi} from "./walletAdapter/walletAdapter";
import {Player} from "./db/model/Player";
import launch from "./route/launch";
import {initMail} from "@slotify/shared/lib/mail";
import roundBalance from "./route/roundBalance";
import sessions from "./route/sessions";
import {getChannel} from "@slotify/shared/lib/getChannel";
import {initRedis} from "@slotify/shared/lib/redis";
import scheduledTasks from "./util/scheduledTasks";
import {initScheduler} from "@slotify/shared/lib/scheduler";
import logger from "@slotify/shared/lib/logger";
import {initAdapterMetrics} from "./util/metrics";

async function initApi(api: Express) {
    api.all(
        "/launch/replay",
        validate([
            check("game").isString().exists().isLength({max: 255}),
            check("roundId")
                .isString()
                .exists()
                .customSanitizer(value => (value ? value : ""))
                .isLength({max: 255}),
        ]),
        async (req, res, next) => {
            if (["GET", "POST"].indexOf(req.method) < 0) return next();

            const channel = getChannel(req.headers["user-agent"]);
            const params = {...req.query, ...req.body, channel};
            res.redirect(await launch("replay", params, req));
        },
    );

    api.all("/launch/fun", validate([check("game").isString().exists().isLength({max: 255}), check("operator").isString().exists().isLength({max: 255})]), async (req, res, next) => {
        if (["GET", "POST"].indexOf(req.method) < 0) return next();

        const channel = getChannel(req.headers["user-agent"]);
        const params = {...req.query, ...req.body, channel};
        res.redirect(await launch("fun", params, req));
    });
    api.all(
        "/launch/real",
        validate([
            check("game").isString().exists().isLength({max: 255}),
            check("operator").isString().exists().isLength({max: 255}),
            check("wallet").isString().exists().isLength({max: 255}),
            check("key")
                .isString()
                .exists()
                .isLength({max: 10 * 1024}),
        ]),
        async (req, res, next) => {
            if (["GET", "POST"].indexOf(req.method) < 0) return next();

            const channel = getChannel(req.headers["user-agent"]);
            const params = {...req.query, ...req.body, channel};
            res.redirect(await launch("real", params, req));
        },
    );

    //internal

    api.post("/api/roundBalance", validate([body("roundIds").isArray()]), async (req, res) => {
        const {roundIds} = req.body;
        res.json(await roundBalance(roundIds));
    });

    api.get("/api/players/:playerId", validate([param("playerId").isString().exists().isUUID(4)]), async (req, res) => {
        const {playerId} = req.params;
        res.json(await Player.getById(playerId));
    });

    api.post("/api/players/:playerId/block", validate([param("playerId").isString().exists().isUUID(4)]), async (req, res) => {
        const {playerId} = req.params;
        logger.warn(`Blocking player ${playerId}`);
        const {blocked: wasBlocked} = await Player.findOneByOrFail({id: playerId});
        await Player.update({id: playerId}, {blocked: true});
        res.json({success: true, wasBlocked});
    });

    api.get("/api/players/:wallet/:nativeId", validate([param("wallet").isString().exists(), param("nativeId").isString().exists()]), async (req, res) => {
        const {wallet, nativeId} = req.params;
        res.json(await Player.getByNativeId(wallet, nativeId));
    });

    api.get("/api/sessions", validate([check("roundId").isString().optional({nullable: true}), check("sessionId").isString().optional({nullable: true})]), async (req, res) => {
        const roundId = req.query.roundId as string;
        const sessionId = req.query.sessionId as string;
        res.json(await sessions(roundId, sessionId));
    });

    api.get("/api/currencies", async (req, res) => {
        res.json(await currencies());
    });

    api.use("/graphql", jwtAuth, async (req, res, next) => {
        const schema = await getSchemas(res.locals.account);
        graphQLApi(schema, auditLog(schema, req))(req, res, next);
    });
}

async function init() {
    const {api} = await createService("adapter");
    await createConnections({
        replica: {...dbOptions("adapter"), host: process.env.REPLICA_DB_HOST, port: process.env.REPLICA_DB_PORT || process.env.DB_PORT, synchronize: false, migrationsRun: false, installExtensions: false} as DataSourceOptions,
        primary: {...dbOptions("adapter")},
    });
    await initRedis("adapter");
    await initApi(api);
    await initRgsApi(api);
    await initWalletApi(api);
    initMail();
    initAdapterMetrics();

    initScheduler(1000);
    await scheduledTasks();

    const server = await startService(api);
    return {api, server};
}

export default init();
