import {AbstractLogger, LogLevel, LogMessage} from "typeorm";
import logger from "./logger";

export class TypeORMLogger extends AbstractLogger {
    protected writeLog(level: LogLevel, logMessage: LogMessage | LogMessage[]) {
        const messages = this.prepareLogMessages(logMessage, {highlightSql: true});

        for (const message of messages) {
            const text = message.prefix ? message.prefix + " " + message.message : message.message;
            switch (message.type ?? level) {
                case "log":
                case "schema-build":
                case "migration":
                    logger.debug(text);
                    break;

                case "info":
                case "query":
                    logger.debug(text);
                    break;

                case "warn":
                case "query-slow":
                    logger.warn(text);
                    break;

                case "error":
                case "query-error":
                    logger.error(text);
                    break;
            }
        }
    }
}
