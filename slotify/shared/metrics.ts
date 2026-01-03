import {Registry, Counter, collectDefaultMetrics, Histogram} from "prom-client";
import {NextFunction, Request, Response} from "express";
import Exception from "./Exception";

let registry: Registry | null = null;

let httpRequestCounter: Counter<string>;

let externalExceptionsCounter: Counter<string>;

let httpRequestLatencyHistogram: Histogram<string>;

export function initMetrics(serviceName: string) {
    if (registry) {
        throw new Exception("Prometheus registry is already registered");
    }
    registry = new Registry();
    registry.setDefaultLabels({serviceName: serviceName, env: process.env.ENV});

    collectDefaultMetrics({register: registry});

    httpRequestCounter = new Counter({
        name: "http_requests_total",
        help: "Total HTTP requests handled by the service",
        labelNames: ["method", "status", "route"],
        registers: [registry],
    });

    externalExceptionsCounter = new Counter({
        name: "exceptions_total",
        help: "Number of external exceptions thrown by the external service",
        labelNames: ["message", "code"],
        registers: [registry],
    });

    httpRequestLatencyHistogram = new Histogram({
        name: "http_request_duration_seconds",
        help: "Duration of HTTP requests in seconds",
        labelNames: ["route"],
        buckets: [0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        registers: [registry],
    });
}

export const httpMetrics = {
    updateHttpRequestsCounter: (route: string, method: string, status: number) => {
        httpRequestCounter.inc({
            method: sanitizeLabelValue(method),
            route: sanitizeLabelValue(route),
            status: status,
        });
    },
    updateHttpRequestLatencyHistogram: (latency: number, route: string) => {
        httpRequestLatencyHistogram.observe(
            {
                route: sanitizeLabelValue(route),
            },
            latency,
        );
    },
    updateHttpExternalExceptionsCounter: (code: number, message: string) => {
        externalExceptionsCounter.inc({
            code: code,
            message: sanitizeLabelValue(message),
        });
    },
};

export function sanitizeLabelValue(value: string): string {
    const maxLength = 200;
    if (value) {
        const truncated = value.length > maxLength ? value.substring(0, maxLength) + "…" : value;
        return JSON.stringify(truncated).slice(1, -1);
    }
    return "unknown";
}

export function getPrometheusRegistry() {
    if (registry) {
        return registry;
    }
    throw new Exception("Prometheus registry not initialized.");
}

export const metricsMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = new Date().getTime();
    res.on("finish", () => {
        const latency = (new Date().getTime() - startTime) / 1000;
        const route = req.route?.path || req.path;
        httpMetrics.updateHttpRequestsCounter(route, req.method, res.statusCode);
        httpMetrics.updateHttpRequestLatencyHistogram(latency, route);
    });
    next();
};
