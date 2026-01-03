import {createService, startService} from "@slotify/shared/lib/api";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {Express} from "express";
import {body} from "express-validator";
import {getConnectionsPerChannel, initWebsocketServer, sendBroadcast, sendMessage, updateAllConnections} from "./route/websocketServer";
import {initRedis} from "@slotify/shared/lib/redis";

async function initApi(api: Express) {
    api.post("/api/message", validate([body("playerId").isUUID(4).exists(), body("service").isString().exists(), body("channel").isString().exists(), body("message").isObject().exists()]), async function (req, res) {
        const {playerId, service, channel, message} = req.body;
        sendMessage(service, channel, playerId, message);
        res.json({success: true});
    });

    api.post("/api/broadcast", validate([body("service").isString().exists(), body("channel").isString().exists(), body("message").isObject().exists()]), async function (req, res) {
        const {service, channel, message} = req.body;
        sendBroadcast(service, channel, message);
        res.json({success: true});
    });

    api.post("/api/connections", validate([body("service").isString().exists()]), async function (req, res) {
        const {service} = req.body;
        res.json(await getConnectionsPerChannel(service));
    });
}

async function init() {
    const {api} = await createService("websocket");
    await initRedis("websocket");
    await initApi(api);
    const server = await startService(api);
    await initWebsocketServer(server, "/websocket/multiplayer", "rgs");
    updateAllConnections();
    return {api, server};
}

export default init();
