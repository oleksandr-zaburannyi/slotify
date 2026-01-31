import {graphQLRequest} from "../util/external";
import {gql} from "graphql-request";
import {jwtSign} from "../middleware/jwtAuth";
import {sendMail} from "@slotify/shared/lib/mail";
import logger from "@slotify/shared/lib/logger";
import {ReportReceiver} from "../db/model/ReportReceiver";
import {toCSV} from "@slotify/shared/lib/csv";
import * as SftpClient from "ssh2-sftp-client";

// noinspection GraphQLUnresolvedReference
const reports = [
    {
        id: "DGE_reports",
        query: gql`
            query ($timestamp: JSON, $wallet: String) {
                DGE_gameSummary(options: {wallet: $wallet, timestamp: $timestamp}) {
                    items {
                        date
                        game
                        brand
                        totalBet
                        totalWin
                        gameWin
                    }
                }
                DGE_pendingRounds(options: {wallet: $wallet, timestamp: $timestamp}) {
                    items {
                        date
                        game
                        brand
                        roundId
                        playerId
                        status
                        bet
                        win
                    }
                }

                DGE_cancelledRounds(options: {wallet: $wallet, timestamp: $timestamp}) {
                    items {
                        date
                        game
                        roundId
                        playerId
                        failReason
                        brand
                        bet
                        win
                    }
                }
            }
        `,
    },
    {
        id: "DGE_jackpot",
        query: gql`
            query ($campaignId: ID!, $timestamp: JSON!) {
                DGE_jackpot(campaignId: $campaignId, timestamp: $timestamp)
            }
        `,
    },
];

export async function downloadReport({account, variables = {}, report}: Partial<ReportReceiver>, timestamp: number) {
    const reportDefinition = reports.find(({id}) => id === report);
    if (!reportDefinition) {
        logger.warn("Report not found", {report});
        return;
    }

    const token = jwtSign(account);
    const response = await graphQLRequest("adapter-graphql", reportDefinition.query, {...variables, timestamp}, token, 2 * 60 * 1000);

    const attachments = [];
    for (const name of Object.keys(response)) {
        attachments.push({
            filename: `${name}.csv`,
            content: toCSV(response[name].items),
            contentType: "text/csv",
        });
    }
    return attachments;
}

export async function sendReport({account, variables = {}, email, report, sftp}: Partial<ReportReceiver>, timestamp: number) {
    const time = new Date(timestamp).toISOString();
    logger.info(`Sending report ${report} to ${email} for ${time}`, {account, variables, email, report, time, sftp});

    const attachments = await downloadReport({account, variables, report}, timestamp);
    if (email) {
        await sendMail(email, `[Report] ${report}`, `Report ${report} generated at ${time}.`, undefined, attachments);
    }
    if (sftp) {
        const sftpClient = new SftpClient();
        try {
            await sftpClient.connect({host: sftp.host, port: sftp.port, username: sftp.username, password: sftp.password});
            const dir = `${sftp.dir}/${time}`;
            if (!(await sftpClient.exists(dir))) {
                await sftpClient.mkdir(dir, true);
            }
            for (const attachment of attachments || []) {
                const buffer = Buffer.from(attachment.content, "utf8");
                await sftpClient.put(buffer, `${dir}/${attachment.filename}.txt`);
            }
        } finally {
            await sftpClient.end();
        }
    }
}
