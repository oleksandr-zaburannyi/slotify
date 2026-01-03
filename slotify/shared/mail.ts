import * as nodemailer from "nodemailer";
import logger from "./logger";
import {Attachment} from "nodemailer/lib/mailer";

const host = process.env.MAIL_HOST;
const port = process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 465;
const user = process.env.MAIL_USER;
const pass = process.env.MAIL_PASSWORD;
const from = process.env.MAIL_FROM || `"${process.env.NAME}" <${user}>`;

const transporter = nodemailer.createTransport({host, port, secure: port === 465, auth: {user, pass}});

export function initMail() {
    transporter.verify(function (error) {
        if (error) {
            logger.error("Mail server error", error);
        } else {
            logger.info("Mail server is ready to take our messages");
        }
    });
}

export async function sendMail(email: string, subject: string, content: string, priority: "high" | "normal" | "low" | undefined = undefined, attachments: Attachment[] | undefined = undefined) {
    content += `<br/></br>--<br/><i>${process.env.NAME}</i>`;
    await transporter.sendMail({
        priority,
        from,
        to: email,
        subject: `Back Office (${process.env.ENV}): ${subject}`,
        text: content,
        html: content,
        attachments,
    });
}
