import {Server} from "http";
import {WebSocket} from "ws";
import {decrypt} from "@slotify/shared/lib/middleware/jwtAuth";
import logger from "@slotify/shared/lib/logger";
import Exception from "@slotify/shared/lib/Exception";
import cache from "@slotify/shared/lib/cache";
import {redis, redisPubSub} from "@slotify/shared/lib/redis";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {v4} from "uuid";
import {startCorrelation} from "@slotify/shared/lib/asyncContext";
import {xorDecrypt, xorEncrypt} from "@slotify/shared/lib/xorCipher";
import {getIp} from "@slotify/shared/lib/ip";

type ConnectionsPerChannel = {[channel: string]: number};
type MessageType = "connected" | "message" | "systemMessage" | "systemConnected" | "ping" | "pong";

const connections: {[service: string]: ConnectionsPerChannel} = {};
const instanceUUID = v4();

const messageChannel = (service: string, channel: string, playerId: string) => `message/${service}/${channel}/${playerId}`;
const broadcastChannel = (service: string, channel: string) => `broadcast/${service}/${channel}`;

export async function initWebsocketServer(server: Server, path: string, service: string) {
    if (!redis.isReady || !redisPubSub.isReady) {
        throw new Exception("Redis must be connected before initialising websocket server");
    }

    await redisPubSub.subscribe("connections/get", async requestId => {
        await redis.publish(`connections/${requestId}`, JSON.stringify(connections));
    });

    const websocketServer = new WebSocket.Server({noServer: true, path});

    server.on("upgrade", async (request, socket, head) => {
        const ip = getIp(request);
        const handleUnauthorizedConnection = () => {
            websocketServer.handleUpgrade(request, socket, head, (webSocket: any) => {
                webSocket.close(1008, "Unauthorized");
            });
        };

        try {
            const searchParams = new URLSearchParams(request.url!.split("?")[1]);
            const type = searchParams.get("type");
            const channel = searchParams.get("channel")!;
            const encryptionKey = searchParams.get("enc");

            if (!channel) {
                logger.warn("Channel not defined");
                handleUnauthorizedConnection();
                return;
            }

            if (type === "system") {
                const signature = searchParams.get("signature")!;
                const systemId = searchParams.get("systemId")!;

                if (!systemId || !signature) {
                    logger.warn("Invalid system connection data");
                    handleUnauthorizedConnection();
                    return;
                }

                logger.info("New system connection started", {type, channel, systemId});

                websocketServer.handleUpgrade(request, socket, head, handleConnectionUpgrade("system", channel, service, {systemId, signature}, encryptionKey, ip));
            } else {
                const token = searchParams.get("token")!;
                const player = decrypt(token, "player");

                if (!player?.playerId) {
                    logger.warn("Invalid player connection data");
                    handleUnauthorizedConnection();
                    return;
                }

                connections[service] ||= {};
                connections[service][channel] ||= 0;
                connections[service][channel]++;

                websocketServer.handleUpgrade(request, socket, head, handleConnectionUpgrade("player", channel, service, {player}, encryptionKey, ip));
            }
        } catch (e) {
            logger.warn("Couldn't initialise socket connection", {error: e});
            handleUnauthorizedConnection();
        }
    });
}

export function sendBroadcast(service: string, channel: string, message: any) {
    logger.info(`WS broadcast from ${service}, channel ${channel}`, {});
    redis.publish(broadcastChannel(service, channel), JSON.stringify(message)).catch(e => {
        logger.warn("Error publishing broadcast message (redis)", {service, channel, message, error: e});
    });
}

export function sendMessage(service: string, channel: string, playerId: string, message: any) {
    logger.info(`WS message from ${service} to player ${playerId}, channel ${channel} `, {playerId, sending: message});
    redis.publish(messageChannel(service, channel, playerId), JSON.stringify(message)).catch(e => {
        logger.warn("Error publishing message (redis)", {service, channel, playerId, message, error: e});
    });
}

function handleConnectionUpgrade(type: "player" | "system", channel: string, service: string, typeData: any, encryptionKey: string | null, ip: string) {
    const sendMessage = (webSocket: WebSocket, id: string) => {
        return (message: string) => {
            try {
                if (encryptionKey) message = xorEncrypt(message, encryptionKey);
                webSocket.send(message);
            } catch (e) {
                logger.warn("Couldn't send websocket message", {id, channel, error: e});
            }
        };
    };

    const onWebsocketMessage = (messageType: MessageType, typeSpecificData: any, webSocket: WebSocket) => {
        const delimiter = "\n--SIG--\n";
        return async (rawData: any) => {
            try {
                let data = rawData.toString();
                if (encryptionKey) data = xorDecrypt(data, encryptionKey);

                if (data === "ping") {
                    const pongMessage = encryptionKey ? xorEncrypt("pong", encryptionKey) : "pong";
                    webSocket.send(pongMessage);
                    return;
                }

                let message: any;
                if (messageType === "systemMessage") {
                    const parts = data.split(delimiter);
                    message = {
                        message: parts[1],
                        signature: parts[0],
                    };
                } else {
                    message = {message: JSON.parse(data)};
                }
                await sendRequest(service, messageType, {...typeSpecificData, channel, ...message, ip});
            } catch (e) {
                logger.warn("Problem processing websocket message", {rawData, error: e});
            }
        };
    };

    let connectionId: string;
    let connectedMessageType: MessageType;
    let messageType: MessageType;
    let connectedData: any;

    if (type === "system") {
        connectedMessageType = "systemConnected";
        messageType = "systemMessage";
        connectionId = typeData.systemId;
        connectedData = {channel, signature: typeData.signature, systemId: typeData.systemId, ip};
    } else {
        connectedMessageType = "connected";
        messageType = "message";
        connectionId = typeData.player.playerId;
        connectedData = {channel, player: typeData.player, ip};
    }

    return async (webSocket: WebSocket) => {
        await updateConnectionsForChannel(service, channel);

        const messageHandler = sendMessage(webSocket, connectionId);

        await redisPubSub.subscribe(broadcastChannel(service, channel), messageHandler);
        await redisPubSub.subscribe(messageChannel(service, channel, connectionId), messageHandler);

        const isSuccess = await sendRequest(service, connectedMessageType, connectedData);
        if (!isSuccess) {
            webSocket.close(1008, "Unauthorized");
            return;
        }
        webSocket.on("message", onWebsocketMessage(messageType, type === "system" ? {systemId: connectionId} : {player: typeData.player}, webSocket));

        webSocket.on("close", async () => {
            if (type === "player") connections[service][channel]--;

            await updateConnectionsForChannel(service, channel);
            if (connections[service][channel] === 0) delete connections[service][channel];
            await redisPubSub.unsubscribe(broadcastChannel(service, channel), messageHandler);
            await redisPubSub.unsubscribe(messageChannel(service, channel, connectionId), messageHandler);
        });
    };
}

async function sendRequest(service: string, type: MessageType, data: {channel: string; ip: string; [key: string]: any}): Promise<boolean> {
    return await startCorrelation({sessionId: data.channel, correlationId: v4()}, async () => {
        try {
            logger.info(`WS request for service ${service}, channel ${data.channel}, type: ${type}`, {receiving: data.message});
            const body = JSON.stringify(data);
            const {success} = await fetchAndParse(`${getServiceUrl(service)}/api/websocket/${type}`, {method: "POST", body, headers: {"Content-Type": "application/json"}});
            return success;
        } catch (error) {
            logger.warn("WS request failed", {data, error});
            return false;
        }
    });
}

const updateConnectionsForChannel = async (service: string, channel: string) => {
    const numberOfConnections = ((connections || {})[service] || {})[channel] || 0;
    const key = `connections:${service}:${channel}:${instanceUUID}`;
    await redis.set(key, numberOfConnections, {EX: 30 * 1000});
};

export function updateAllConnections() {
    setInterval(() => {
        Object.keys(connections).forEach(service =>
            Object.keys(connections[service] || {}).forEach(channel => {
                updateConnectionsForChannel(service, channel).catch(e => {
                    logger.warn("Error updating connections for channel", {service, channel, error: e});
                });
            }),
        );
    }, 10 * 1000 /*10 seconds*/);
}

const getConnectionsForChannel = async (service: string, channel: string) => {
    const keys = await redis.keys(`connections:${service}:${channel}:*`);
    return (await redis.mGet(keys)).map(value => (value ? parseInt(value, 10) : 0)).reduce((prev, value) => prev + value, 0);
};

export const getConnectionsPerChannel = cache(30, async (service: string) => {
    const connectionsPerChannel: ConnectionsPerChannel = {};
    for (const channel of Object.keys(connections[service] || {})) {
        connectionsPerChannel[channel] = await getConnectionsForChannel(service, channel);
    }
    return connectionsPerChannel;
});
