import {graphQLRequest} from "../util/external";
import {gql} from "graphql-request";
import {jwtSign} from "../middleware/jwtAuth";
import {sendMail} from "@slotify/shared/lib/mail";
import logger from "@slotify/shared/lib/logger";
import {ReportReceiver} from "../db/model/ReportReceiver";
import {toCSV} from "@slotify/shared/lib/csv";

// noinspection GraphQLUnresolvedReference
const reports = [
    {
        id: "DGE_reports",
        query: gql`
            query ($timestamp: JSON, $wallet: String) {
                DGE_gameSummary(options: {wallet: $wallet, timestamp: $timestamp}) {
                    items {
                        from
                        to
                        game
                        wallet
                        operator
                        brand
                        bets
                        wins
                        totalBet
                        totalWin
                        gameWin
                    }
                }
                DGE_pendingRounds(options: {wallet: $wallet, timestamp: $timestamp}) {
                    items {
                        createdAt
                        game
                        variant
                        roundId
                        playerId
                        status

                        wallet
                        operator
                        brand
                        currency

                        bet
                        win
                    }
                }

                DGE_cancelledRounds(options: {wallet: $wallet, timestamp: $timestamp}) {
                    items {
                        createdAt
                        game
                        variant
                        roundId
                        playerId
                        failReason

                        wallet
                        operator
                        brand
                        currency

                        bet
                        win
                    }
                }
            }
        `,
    },
];

export async function sendReport({account, variables = {}, email, report}: ReportReceiver, timestamp: number) {
    const reportDefinition = reports.find(({id}) => id === report);
    if (!reportDefinition) {
        logger.warn("Report not found", {report});
        return;
    }
    const time = new Date(timestamp).toISOString();
    logger.info(`Sending report ${report} to ${email} for ${time}`, {account, variables, email, report, time});

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

    await sendMail(email, `[Report] ${report}`, `Report ${report} generated at ${time}.`, undefined, attachments);
}
