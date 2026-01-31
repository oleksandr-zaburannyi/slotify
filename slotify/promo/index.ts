import {createService, startService} from "@slotify/shared/lib/api";
import {Express} from "express";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {body, check, param, query} from "express-validator";
import {DataSourceOptions} from "typeorm";
import dbOptions, {createConnections} from "@slotify/shared/lib/dbOptions";
import auth from "@slotify/shared/lib/middleware/jwtAuth";
import resolvers from "./graphql/resolvers";
import {graphQLApi} from "@slotify/shared/lib/graphQLApi";
import {addResolversToSchema} from "@graphql-tools/schema";
import {loadSchema} from "@graphql-tools/load";
import {GraphQLFileLoader} from "@graphql-tools/graphql-file-loader";
import {acknowledge, authenticate, campaign, campaignFeed, campaigns, IPlayer, opt, play, playerEvent, playerFeed, transactions} from "./util/routes";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {theme} from "./themes/theme";
import {initRedis} from "@slotify/shared/lib/redis";
import {initScheduler} from "@slotify/shared/lib/scheduler";
import scheduledTasks from "./util/scheduleTasks";
import {initToolsStreams} from "./tools/tools";

async function initApi(api: Express) {
    api.post(
        "/api/authenticate",
        validate([
            body("provider").isString().optional().isLength({max: 255}),
            body("game").isString().optional().isLength({max: 255}),
            body("playerId").isString().exists().isLength({max: 255}),
            body("wallet").isString().exists().isLength({max: 255}),
            body("operator").isString().exists().isLength({max: 255}),
            body("brand").isString().optional({nullable: true}).isLength({max: 255}),
            body("nativeId").isString().exists(),
            body("currency").isString().exists().isLength({max: 255}),
            body("jurisdiction").isString().optional({nullable: true}).isLength({max: 255}),
            body("campaignTypes").isArray().optional({nullable: true}).isLength({max: 255}),
        ]),
        async function (req, res) {
            const {provider, game, playerId, nickname, wallet, operator, brand, nativeId, currency, jurisdiction, campaignTypes} = req.body;
            const player: IPlayer = {playerId, nickname, provider, nativeId, wallet, operator, brand, game, currency, jurisdiction};

            res.json(await authenticate(player, campaignTypes));
        },
    );

    api.all("/campaigns", auth.verify("player"), validate([check("provider").isString().optional().isLength({max: 255}), check("game").isString().optional().isLength({max: 255})]), async function (req, res) {
        const {game, provider} = {...req.query, ...req.body} as Record<string, string>; //we need to support it in both GET and POST
        const {playerId, nickname, brand, operator, wallet, nativeId, currency, jurisdiction}: IPlayer = res.locals.user;
        const player: IPlayer = {playerId, nickname, provider, nativeId, wallet, operator, brand, game, currency, jurisdiction};

        res.json(await campaigns(player));
    });

    api.get(
        "/campaigns/:campaignId",
        auth.verify("player"),
        validate([param("campaignId").isString().optional().isLength({max: 255}), query("provider").isString().optional().isLength({max: 255}), query("game").isString().optional().isLength({max: 255})]),
        async function (req, res) {
            const campaignId = req.params.campaignId;
            const {game, provider} = req.query as Record<string, string>;
            const {playerId, nickname, brand, operator, wallet, nativeId, currency, jurisdiction}: IPlayer = res.locals.user;
            const player: IPlayer = {playerId, nickname, provider, nativeId, wallet, operator, brand, game, currency, jurisdiction};

            res.json(await campaign(campaignId, player));
        },
    );

    api.post(
        "/campaigns/:campaignId/opt",
        auth.verify("player"),
        validate([param("campaignId").isString().isLowercase().isLength({max: 255}), body("optIn").isBoolean(), body("provider").isString().optional().isLength({max: 255}), body("game").isString().optional().isLength({max: 255})]),
        async function (req, res) {
            const {optIn, provider, game} = req.body;
            const {campaignId} = req.params;
            const {playerId, nickname, brand, operator, wallet, nativeId, currency, jurisdiction}: IPlayer = res.locals.user;
            const player: IPlayer = {playerId, nickname, provider, nativeId, wallet, operator, brand, game, currency, jurisdiction};

            res.json(await opt(optIn, campaignId, player));
        },
    );

    api.post(
        "/campaigns/:campaignId/acknowledge",
        auth.verify("player"),
        validate([param("campaignId").isString().isLowercase().isLength({max: 255}), body("provider").isString().optional().isLength({max: 255}), body("game").isString().optional().isLength({max: 255})]),
        async function (req, res) {
            const {provider, game} = req.body;
            const {campaignId} = req.params;
            const {playerId, nickname, brand, operator, wallet, nativeId, currency, jurisdiction}: IPlayer = res.locals.user;
            const player: IPlayer = {playerId, nickname, provider, nativeId, wallet, operator, brand, game, currency, jurisdiction};

            res.json(await acknowledge(campaignId, player));
        },
    );

    api.post(
        "/event/player/:campaignId",
        auth.verify("player"),
        validate([
            param("campaignId").isString().isLowercase().optional().isLength({max: 255}),
            body("provider").isString().optional().isLength({max: 255}),
            body("game").isString().optional().isLength({max: 255}),
            body("eventName").isString().optional().isLength({max: 255}),
            body("eventId").isString().optional().isLength({max: 255}),
            body("params").optional(),
        ]),
        async function (req, res) {
            const {campaignId} = req.params;
            const {provider, game, eventName, eventId, params} = req.body;
            const {playerId, nickname, brand, operator, wallet, nativeId, currency, jurisdiction}: IPlayer = res.locals.user;
            const player: IPlayer = {playerId, nickname, provider, nativeId, wallet, operator, brand, game, currency, jurisdiction};

            res.json(await playerEvent(campaignId, player, eventName, eventId, params));
        },
    );

    api.get("/feed/campaign/:campaignId", validate([param("campaignId").isUUID().isLength({max: 255})]), async (req, res) => {
        const {campaignId} = req.params;
        const params = req.query as Record<string, string>;

        res.json(await campaignFeed(campaignId, params));
    });

    api.get("/feed/player/:campaignId/", auth.verify("player"), validate([param("campaignId").isString().optional().isLength({max: 255})]), async function (req, res) {
        const {campaignId} = req.params;
        const {playerId}: IPlayer = res.locals.user;
        const params = req.query as Record<string, string>;

        res.json(await playerFeed(campaignId, playerId, params));
    });

    api.get("/feed/player/:campaignId/:playerId", validate([param("campaignId").isUUID().isLength({max: 255}), param("playerId").isUUID().isLength({max: 255})]), async (req, res) => {
        const {campaignId, playerId} = req.params;
        const params = req.query as Record<string, string>;

        res.json(await playerFeed(campaignId, playerId, params));
    });

    api.get("/feed/player/:campaignId/:wallet/:nativeId", validate([param("campaignId").isUUID().isLength({max: 255}), param("wallet").isString().isLength({max: 255}), param("nativeId").isString()]), async (req, res) => {
        const {campaignId, wallet, nativeId} = req.params;
        const {id} = await fetchAndParse(`${getServiceUrl("adapter")}/api/players/${wallet}/${nativeId}`);
        const params = req.query as Record<string, string>;

        res.json(await playerFeed(campaignId, id, params));
    });

    api.get("/theme/:campaignId/:language", validate([param("campaignId").isUUID().isLength({max: 255}), param("language").isString().isLength({max: 255})]), async (req, res) => {
        const {campaignId, language} = req.params;
        const defaultCampaignThemeName = req.query.defaultCampaignThemeName as string;
        res.json(await theme(campaignId, language, defaultCampaignThemeName));
    });

    //internal

    api.post(
        "/api/transaction/:mode",
        validate([
            body("playerId").isString().exists().isLength({max: 255}),
            body("nativeId").isString().exists(),
            body("wallet").isString().exists().isLength({max: 255}),
            body("operator").isString().exists().isLength({max: 255}),
            body("brand").optional({nullable: true}).isString().isLength({max: 255}),
            body("transactionId").isString().exists().isLength({max: 255}),
            body("type").isString().exists().isLength({max: 16}),
            body("category").isString().optional({nullable: true}).isLength({max: 255}),
            body("amount").isFloat().exists(),
            body("provider").isString().exists().isLength({max: 255}),
            body("game").isString().exists().isLength({max: 255}),
            body("roundId").isString().exists().isLength({max: 255}),
            body("roundFinished").isBoolean().optional(),
            body("currency").isString().exists().isLength({max: 255}),
            body("jurisdiction").optional({nullable: true}).isString().isLength({max: 255}),
            body("nickname").optional({nullable: true}).isString().isLength({max: 255}),
        ]),
        async function (req, res) {
            const {playerId, nickname, nativeId, wallet, operator, brand, transactionId, amount, provider, game, roundId, roundFinished, currency, jurisdiction, category} = req.body;
            const player: IPlayer = {playerId, nickname, nativeId, wallet, operator, brand, provider, game, currency, jurisdiction};
            const mode = req.params.mode as "withdraw" | "deposit" | "withdrawFinished" | "depositFinished" | "cancel" | "withdrawFailed";

            res.json(await transactions(mode, player, {amount, roundId, roundFinished, game, transactionId, category}));
        },
    );

    api.post(
        "/api/play",
        validate([
            body("playerId").isString().exists().isLength({max: 255}),
            body("nativeId").isString().exists().isLength({max: 255}),
            body("wallet").isString().exists().isLength({max: 255}),
            body("operator").isString().exists().isLength({max: 255}),
            body("brand").optional({nullable: true}).isString().isLength({max: 255}),
            body("provider").isString().exists().isLength({max: 255}),
            body("game").isString().exists().isLength({max: 255}),
            body("currency").isString().exists().isLength({max: 255}),
            body("jurisdiction").optional({nullable: true}).isString().isLength({max: 255}),
            body("nickname").optional({nullable: true}).isString().isLength({max: 255}),
            body("roundId").isString().exists().isLength({max: 255}),
            body("step").isInt().exists(),
            body("campaigns").isObject().exists(),
        ]),
        async function (req, res) {
            const {playerId, nativeId, wallet, operator, brand, provider, game, currency, jurisdiction, nickname, roundId, step, campaigns} = req.body;
            const player: IPlayer = {playerId, nickname, nativeId, wallet, operator, brand, provider, game, currency, jurisdiction};

            res.json(await play(player, roundId, step, campaigns));
        },
    );

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
    const {api} = await createService("promo");
    await createConnections({
        replica: {...dbOptions("promo"), host: process.env.REPLICA_DB_HOST, port: process.env.REPLICA_DB_PORT || process.env.DB_PORT, synchronize: false, migrationsRun: false, installExtensions: false} as DataSourceOptions,
        primary: {...dbOptions("promo")} as DataSourceOptions,
    });
    await initApi(api);

    await initRedis("promo");
    await scheduledTasks();
    await initToolsStreams();
    initScheduler(1000);

    const server = await startService(api);

    return {api, server};
}

export default init();
