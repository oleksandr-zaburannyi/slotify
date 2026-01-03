import * as winston from "winston";
import {correlationData} from "./asyncContext";

const log = process.env.LOG;
const env = process.env.ENV;
const level = process.env.LOG_LEVEL || "info";

const logger = winston.createLogger({level});
logger.add(
    new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple(), winston.format.errors({stack: true}), winston.format.timestamp()),
    }),
);

export function initLogger(service: string): void {
    if (log === "gcp") {
        // clear default logger transport
        logger.clear();

        logger.add(
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.printf(({message, level, httpRequest, ...data}) => {
                        return JSON.stringify({message, httpRequest, data, severity: level.toUpperCase(), meta: {service, env, ...correlationData}});
                    }),
                ),
            }),
        );
    } else if (log === "json") {
        // clear default logger transport
        logger.clear();

        logger.add(
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.printf(data => {
                        return JSON.stringify({...data, meta: {service, env, ...correlationData}});
                    }),
                ),
            }),
        );
    }
}

export default logger;
