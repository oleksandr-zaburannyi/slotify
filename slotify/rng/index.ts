import {createService, startService} from "@slotify/shared/lib/api";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {body, query} from "express-validator";
import {Express} from "express";
import * as rng from "./lib";
import {initMail} from "@slotify/shared/lib/mail";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import {DataSourceOptions} from "typeorm";
import {updateClientSeed} from "./fairness/client/updateClientSeed";
import {activeRngSeeds} from "./fairness/client/activeRngSeeds";
import {roundRngState} from "./fairness/client/roundRngState";
import auth from "@slotify/shared/lib/middleware/jwtAuth";
import {getRoundRngState} from "./fairness/getRoundRngState";
import {updateRoundRngCursor} from "./fairness/updateRoundRngCursor";
import {closeRoundRngState} from "./fairness/closeRoundRngState";
import {initPlayerSeeds} from "./fairness/initPlayerSeeds";
import {graphQLApi} from "@slotify/shared/lib/graphQLApi";
import {addResolversToSchema} from "@graphql-tools/schema";
import {loadSchema} from "@graphql-tools/load";
import {GraphQLFileLoader} from "@graphql-tools/graphql-file-loader";
import resolvers from "./graphql/resolvers";
import {unhashServerSeed} from "./fairness/client/unhashServerSeed";
import {drawRngState} from "./fairness/client/drawRngState";
import {generateHashChain} from "./fairness/generateHashChain";
import {getDrawRngState} from "./fairness/getDrawRngState";
import {updateRngHashCursor} from "./fairness/updateRngHashCursor";
import {setRngSeed} from "./fairness/setRngSeed";
import {initRedis} from "@slotify/shared/lib/redis";

async function initApi(api: Express) {
    api.get("/api/numbers", validate([query("total").isInt({min: 1, max: 10000}).exists(), query("provider").isString().exists(), query("game").isString().exists()]), async function (req, res) {
        const numbers: number[] = [];
        const total = parseInt(req.query.total as string, 10);
        for (let i = 0; i < total; i++) {
            numbers.push(rng.random());
        }
        res.json({numbers});
    });

    api.post("/api/fairness/initPlayerSeeds", validate([body("playerId").isUUID().exists()]), async function (req, res) {
        const {playerId} = req.body;
        await initPlayerSeeds(playerId);
        res.json({success: true});
    });

    api.post("/api/fairness/getRoundRngState", validate([body("playerId").isUUID().exists(), body("roundId").isUUID().exists(), body("game").isString().exists().isLength({max: 255})]), async function (req, res) {
        const {playerId, roundId, game} = req.body;
        res.json(await getRoundRngState(playerId, roundId, game));
    });

    api.post("/api/fairness/updateRoundRngCursor", validate([body("roundId").isUUID().exists(), body("cursor").isInt().exists(), body("closed").isBoolean().optional({nullable: true})]), async function (req, res) {
        const {roundId, cursor, closed} = req.body;
        await updateRoundRngCursor(roundId, cursor, closed);
        res.json({success: true});
    });

    api.post("/api/fairness/closeRoundRngState", validate([body("roundId").isUUID().exists()]), async function (req, res) {
        const {roundId} = req.body;
        await closeRoundRngState(roundId);
        res.json({success: true});
    });

    api.post("/fairness/updateClientSeed", auth.verify("player"), validate([body("clientSeed").isString().exists().isLength({max: 64})]), async (req, res) => {
        const {playerId} = res.locals.user;
        const {clientSeed} = req.body;
        res.json(await updateClientSeed(playerId, clientSeed));
    });

    api.get("/fairness/activeRngSeeds", auth.verify("player"), async (req, res) => {
        const {playerId} = res.locals.user;
        res.json(await activeRngSeeds(playerId));
    });

    api.get("/fairness/roundRngState", validate([query("roundId").isUUID().exists()]), async (req, res) => {
        const {roundId} = req.query as Record<string, string>;
        res.json(await roundRngState(roundId));
    });

    api.get("/fairness/unhashServerSeed", validate([query("serverSeedHash").isString().exists()]), async (req, res) => {
        const {serverSeedHash} = req.query as Record<string, string>;
        res.json(await unhashServerSeed(serverSeedHash));
    });

    api.post("/api/fairness/generateHashChain", validate([body("roomId").isUUID().exists(), body("chainLength").isInt().exists()]), async function (req, res) {
        const {roomId, chainLength} = req.body;
        res.json(await generateHashChain(roomId, chainLength));
    });

    api.post("/api/fairness/setRngSeed", validate([body("roomId").isUUID().exists(), body("seed").isString().isLength({min: 1, max: 64}).exists()]), async function (req, res) {
        const {roomId, seed} = req.body;
        res.json(await setRngSeed(roomId, seed));
    });

    api.post("/api/fairness/getDrawRngState", validate([body("roomId").isUUID().exists(), body("drawId").isUUID().exists()]), async function (req, res) {
        const {roomId, drawId} = req.body;
        res.json(await getDrawRngState(roomId, drawId));
    });

    api.post("/api/fairness/updateRngHashCursor", validate([body("drawId").isUUID().exists(), body("cursor").isInt().exists()]), async function (req, res) {
        const {drawId, cursor} = req.body;
        res.json(await updateRngHashCursor(drawId, cursor));
    });

    api.get("/fairness/drawRngState", validate([query("drawId").isUUID().exists()]), async (req, res) => {
        const {drawId} = req.query as Record<string, string>;
        res.json(await drawRngState(drawId));
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
}

async function init() {
    const {api} = await createService("rng");
    await createConnections({
        replica: {...dbOptions("rng"), host: process.env.REPLICA_DB_HOST, port: process.env.REPLICA_DB_PORT || process.env.DB_PORT, synchronize: false, migrationsRun: false, installExtensions: false} as DataSourceOptions,
        primary: {...dbOptions("rng")},
    });
    await initApi(api);
    initMail();

    await initRedis("rng");
    const server = await startService(api);
    return {api, server};
}

export default init();
