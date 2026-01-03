import {sendMail} from "./mail";
import logger from "./logger";
import {sendSlackMessage} from "./slack";

const supportEmaiil = process.env.SUPPORT_EMAIL;

export function sendAlert(subject: string, content: string, priority: boolean = false) {
    logger.warn(subject, {content});

    sendMail(supportEmaiil!, subject, content, priority ? "high" : "normal").catch(e => logger.error("Couldn't send alert email", e));

    sendSlackMessage(subject, content, priority).catch(e => logger.error("Couldn't send alert slack message", e));
}
