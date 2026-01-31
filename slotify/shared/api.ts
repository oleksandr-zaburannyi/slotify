import * as fs from "fs";
import {readFileSync} from "fs";
import {createHttpTerminator, HttpTerminator} from "http-terminator";
import * as bodyParser from "body-parser";
import * as compression from "compression";
import * as cors from "cors";
import * as express from "express";
import {ErrorRequestHandler, Express, Request} from "express";
import Exception from "./Exception";
import {isDevMode} from "./isDevMode";
import logger, {initLogger} from "./logger";
import {StatusCode} from "./StatusCode";
import {startCorrelation} from "./asyncContext";
import {Server} from "http";
import {getConnection, getConnections} from "./dbOptions";
import {check} from "express-validator";
import {validate} from "./middleware/validate";
import checksum from "./checksum";
import fetch from "./fetch";
import {getServiceUrl} from "./urls";
import * as process from "process";
import {v4} from "uuid";
import {getPrometheusRegistry, httpMetrics, initMetrics, metricsMiddleware} from "./metrics";
import {xorDecrypt, xorEncrypt} from "./xorCipher";
import wait from "./wait";

export async function createService(
    name: string,
    limit: string | number | undefined = undefined,
): Promise<{
    api: Express;
}> {
    initLogger(name);
    initMetrics(name);
    logger.info(`Creating service ${name}!`);

    const api = express();
    api.disable("x-powered-by");

    api.use(function (req, res, next) {
        if (process.env.ALLOW_HTTP !== "true") {
            res.set("Strict-Transport-Security", "max-age=3600");
        }
        res.set("X-Content-Type-Options", "nosniff");
        res.set("Cache-Control", "no-cache, no-store, no-transform, must-revalidate, post-check=0, pre-check=0");

        next();
    });

    api.use(metricsMiddleware);

    api.use(compression());
    api.use(
        cors({
            origin: process.env.CORS_ORIGIN || "*",
            maxAge: 10 * 60 /*10 minutes*/,
        }),
    );
    const verify = (req: any, res: any, buf: any) => {
        (req as any).rawBody = buf.toString();
    };
    api.use("/graphql", bodyParser.json({limit: "1mb", verify}));
    api.use(/^\/(?!graphql\/?$).*$/, bodyParser.json({limit, verify}));

    api.use((req, res, next) => {
        const encryptionKey = req.headers["enc"];
        if (encryptionKey && req.body && Array.isArray(req.body) && req.body.length === 1 && typeof req.body[0] === "string") {
            try {
                req.body = JSON.parse(xorDecrypt(req.body[0], encryptionKey as string));
            } catch (err) {
                next(err);
            }
        }
        next();
    });

    const getActualRequestDurationInMilliseconds = (start: [number, number]) => {
        const NS_PER_SEC = 1e9; // convert to nanoseconds
        const NS_TO_MS = 1e6; // convert to milliseconds
        const diff = process.hrtime(start);
        return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
    };

    const ignoreBody = ["/graphql"];
    const maxBodyLength = 1000;
    const logBody = (originalUrl: string, body: any, rawBody: string | undefined) => {
        if (ignoreBody.includes(originalUrl)) return undefined;
        if (rawBody && rawBody.length > maxBodyLength) return rawBody.substring(0, maxBodyLength);
        return body || rawBody;
    };

    api.use((req, res, next) => {
        const store = {
            correlationId: req.get("x-correlation-id") || v4(),
            sessionId: req.get("x-session-id") || v4(),
        };
        startCorrelation(store, () => {
            const start = process.hrtime();
            const resEnd = res.end;

            (res as any).end = function (chunk: any, ...args: any[]) {
                resEnd.apply(this, [chunk, ...args] as any);

                const message = `${req.originalUrl}`;
                const meta = {
                    httpRequest: {
                        status: res.statusCode,
                        requestUrl: req.originalUrl,
                        requestMethod: req.method,
                        remoteIp: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
                        responseSize: res.getHeader("Content-Length"),
                        userAgent: req.get("User-Agent"),
                        latency: Math.round(getActualRequestDurationInMilliseconds(start)) / 1000 + "s",
                    },
                    request: logBody(req.originalUrl, req.body, (req as any).rawBody),
                    response: logBody(req.originalUrl, (res as any).body, chunk?.toString?.()),
                };

                const ignore = ["/health", "/health/all", "/metrics", "/"];

                if (res.statusCode >= 400) {
                    logger.warn(message, meta);
                } else if (ignore.includes(req.originalUrl) || req.method === "OPTIONS") {
                    logger.verbose(message, meta);
                } else if (isInternal(req)) {
                    logger.http(message, meta);
                } else {
                    logger.info(message, meta);
                }
            };

            const resJson = res.json;
            (res as any).json = function (obj: any) {
                (res as any).body = obj;
                resJson.apply(res, [obj]);
            };

            const resSend = res.send;
            (res as any).send = function (chunk: any) {
                const encryptionKey = req.headers["enc"];
                if (typeof chunk === "string" && encryptionKey) {
                    chunk = xorEncrypt(chunk, encryptionKey as string);
                }
                resSend.apply(res, [chunk]);
            };

            next();
        });
    });

    return {api};
}

let isShutdown = false;
let httpTerminator: HttpTerminator | null = null;

if (process.env.ENV !== "local") {
    process.on("SIGTERM", () => {
        logger.info("SIGTERM received");
        if (isShutdown) return;
        isShutdown = true;
        setTimeout(async () => {
            await httpTerminator?.terminate();
            logger.info("HTTP connections terminated successfully");

            for (const name in getConnections()) {
                const connection = getConnection(name);
                await connection.destroy();
            }
            logger.info("DB connections terminated successfully");

            process.exit(0);
        }, 15 * 1000 /* 15 seconds */);
    });
}

const isDbAlive = async (): Promise<boolean> => {
    for (const name in getConnections()) {
        const connection = getConnection(name);
        if (!connection.isInitialized) return false;
        try {
            await connection.query("select 1");
        } catch (e) {
            logger.warn("DB query error", {error: e});
            return false;
        }
    }
    return true;
};

export async function startService(api: Express, defaultPort: number = 8080): Promise<Server> {
    const failAfter = async (ms: number): Promise<never> => {
        await wait(ms);
        throw new Exception(`waited ${ms}ms before failing`);
    };

    api.get(["/", "/health"], async (req, res) => {
        if (isShutdown) {
            logger.warn("[Readiness] Shutting down");
            res.status(503).send("QUITING");
            return;
        }

        try {
            const dbAlive = await Promise.race([isDbAlive(), failAfter(5000)]);

            if (!dbAlive) {
                logger.warn("[Readiness] DB not connected");
                res.status(503).send("DB NOT CONNECTED");
                return;
            }

            res.send("OK");
        } catch (error) {
            logger.error("[Readiness] DB health check timed out", {error});
            res.status(503).send("DB HEALTH CHECK TIMED OUT");
            return;
        }
    });

    api.get("/version", async (req, res) => {
        try {
            const file = readFileSync(process.cwd() + "/package.json").toString();
            const version = JSON.parse(file).version;
            res.send(version);
        } catch {
            res.send("UNKNOWN");
        }
    });

    api.get("/health/all", async (req, res) => {
        const services: Record<string, string> = {};
        let status = StatusCode.OK;
        for (const variable in process.env) {
            if (variable.endsWith("_SERVICE_HOST") && variable !== "KUBERNETES_SERVICE_HOST") {
                const name = variable.replace("_SERVICE_HOST", "").toLowerCase();
                const url = `${getServiceUrl(name)}/health`;
                let res = "";
                try {
                    res = await (await fetch(url)).text();
                    if (res !== "OK") status = StatusCode.BAD_REQUEST;
                } catch {
                    status = StatusCode.BAD_REQUEST;
                    res = "OFFLINE";
                }
                services[name] = res;
            }
        }
        if (status !== StatusCode.OK) {
            logger.error("[health] One or more services are offline", {services});
        }
        res.status(status).json(services);
    });

    api.get("/metrics", async (_req, res) => {
        const registry = getPrometheusRegistry();
        res.setHeader("Content-Type", registry.contentType);
        res.send(await registry.metrics());
    });

    api.get("/version/all", async (req, res) => {
        const services: Record<string, string> = {};
        for (const variable in process.env) {
            if (variable.endsWith("_SERVICE_HOST") && variable !== "KUBERNETES_SERVICE_HOST") {
                const name = variable.replace("_SERVICE_HOST", "").toLowerCase();
                const url = `${getServiceUrl(name)}/version`;
                let version = "UNKNOWN";
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        version = await res.text();
                    }
                } catch (e) {
                    logger.warn(e);
                }
                services[name] = version;
            }
        }
        res.json(services);
    });

    api.get("/api/criticalFileChecksum", validate([check("criticalFilePath").isString().isLength({max: 255})]), async (req, res) => {
        const {criticalFilePath} = req.query;
        const absolutePath = process.cwd() + "/" + criticalFilePath;

        const data = await new Promise<string>((resolve, reject) =>
            fs.readFile(absolutePath as string, "utf8", (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(data);
            }),
        );

        res.json({checksum: checksum(data)});
    });

    api.use((req, res, next) => {
        const ignore = ["/favicon.ico", "/robots.txt"];
        if (!ignore.includes(req.baseUrl)) {
            throw new Exception("Unknown path", {status: StatusCode.NOT_FOUND, data: {path: req.baseUrl}});
        }
        next();
    });

    api.use(((err, req, res, next) => {
        const {message, stack} = err;
        const code = err.code || "APPLICATION_ERROR";
        if (err instanceof Exception) {
            const isInternalError = isInternal(req);
            logger.warn(`Exception ${code}: ${message}`, {
                code,
                stack,
                errorMessage: message, //this cannot be called message, because logger doubles the message...
                status: err.status,
                data: err.data,
                name: err.name,
                payload: err.payload,
                popups: err.popups,
                external: !isInternalError,
            });
            if (!isInternalError) {
                httpMetrics.updateHttpExternalExceptionsCounter(code, err.data?.message);
            }

            res.status(err.status != null ? err.status : StatusCode.BAD_REQUEST).json({
                error: {
                    code,
                    message: isDevMode() || isInternal(req) ? message : "Application Error",
                    payload: err.payload,
                    popups: err.popups,
                },
            });
        } else {
            logger.error(stack);
            res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
                error: {
                    message: isDevMode() ? message : "Server Error",
                    code: "SERVER_ERROR",
                },
            });
        }
        next();
    }) as ErrorRequestHandler);

    const port = process.env.PORT || defaultPort;
    const server = await api.listen(port);
    server.setTimeout(60 * 1000);
    httpTerminator = createHttpTerminator({server, gracefulTerminationTimeout: 10 * 1000});
    server.keepAliveTimeout = 62 * 1000;
    server.headersTimeout = 64 * 1000;
    logger.info(`Service listening on port ${port}!`);
    return server;
}

export function isInternal(req: Request) {
    return !!req.headers["x-correlation-id"];
}
