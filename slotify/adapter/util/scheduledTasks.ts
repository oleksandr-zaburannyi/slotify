import {fetchCurrencies} from "../currencyFeed/currencyFeed";
import {getNextCronTimestamp, hasTask, registerSchedulerCallback, scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import logger from "@slotify/shared/lib/logger";
import {clearAuditLogs} from "../route/clearAuditLogs";
import cube from "../route/cube";
import wait from "@slotify/shared/lib/wait";
import proxy from "../route/proxy";
import {sendReport} from "../route/sendReports";
import {ReportReceiver} from "../db/model/ReportReceiver";
import {invalidate} from "@slotify/shared/lib/cache";
import {archiveSessions, archiveTransactions} from "../route/archive";

async function scheduleFetchCurrencies() {
    await scheduleTask("fetchCurrencies", "cron", getNextCronTimestamp("0 6,18 * * *"), {});
}

async function scheduleClearAuditLogs() {
    await scheduleTask("clearAuditLogs", "cron", getNextCronTimestamp("0 6,18 * * *"), {});
}

async function scheduleCube() {
    await scheduleTask("cube", "cron", getNextCronTimestamp("*/5 * * * *"), {}); // every 5 minutes starting at minute 0
}

async function scheduleArchiveAdapter() {
    if (!(await hasTask("archiveAdapterTransactions", "cron"))) {
        await scheduleTask("archiveAdapterTransactions", "cron", 0, {});
    }
    if (!(await hasTask("archiveAdapterSessions", "cron"))) {
        await scheduleTask("archiveAdapterSessions", "cron", 0, {});
    }
}

async function scheduleSendReports() {
    for (const reportReceiver of await ReportReceiver.find()) {
        if (await hasTask("reportReceiver", reportReceiver.id.toString())) continue;
        await scheduleReport(reportReceiver);
    }
}

export async function scheduleReport(reportReceiver: ReportReceiver) {
    const timestamp = getNextCronTimestamp(reportReceiver.cron);
    await scheduleTask("reportReceiver", reportReceiver.id.toString(), timestamp, {timestamp, id: reportReceiver.id});
}

export async function unscheduleReport(reportReceiverId: number) {
    await unsheduleTask("reportReceiver", reportReceiverId.toString());
}

export default async function scheduledTasks(): Promise<void> {
    await scheduleFetchCurrencies();
    await scheduleClearAuditLogs();
    await scheduleCube();
    await scheduleArchiveAdapter();
    await scheduleSendReports();
}

registerSchedulerCallback("fetchCurrencies", async () => {
    logger.info("fetchCurrencies started");
    await fetchCurrencies();
    await scheduleFetchCurrencies();
    invalidate("currencyRates");
});

registerSchedulerCallback("clearAuditLogs", async () => {
    logger.info("clearAuditLogs started");
    await clearAuditLogs();
    await scheduleClearAuditLogs();
});

registerSchedulerCallback("cube", async () => {
    logger.info("cube started");
    await wait(10 * 1000); //wait 10s for the replication to catch up
    await cube(undefined, undefined, () => logger.info("cube completed"));
    await scheduleCube();
});

registerSchedulerCallback("endSession", async ({sessionId}) => {
    await proxy.endActiveSession("expired", sessionId);
});

registerSchedulerCallback("reportReceiver", async ({timestamp, id}) => {
    const reportReceiver = await ReportReceiver.findOneBy({id});
    if (!reportReceiver) {
        await unscheduleReport(id);
        return;
    }

    try {
        await sendReport(reportReceiver, timestamp);
    } catch (error) {
        logger.error(`Couldn't send report ${reportReceiver.report} to  ${reportReceiver.email}`, {
            timestamp,
            reportReceiver,
            error,
        });
    }

    await scheduleReport(reportReceiver);
});

export async function cleanupScheduledTasks() {
    try {
        await unsheduleTask("fetchCurrencies", "cron");
        await unsheduleTask("clearAuditLogs", "cron");
        await unsheduleTask("cube", "cron");
        await unsheduleTask("archiveAdapter", "cron");
        // Note: We can't unschedule reportReceiver tasks here as they require database access
        // The scheduler should handle cleanup of these tasks when stopped
    } catch (error) {
        logger.warn("Failed to unschedule scheduled tasks", error);
    }
}

registerSchedulerCallback("archiveAdapterTransactions", async () => {
    logger.info("archiveAdapterTransactions started");
    const scheduleAsap = await archiveTransactions();

    const time = Date.now() + (scheduleAsap ? 500 : 5 * 60 * 1000); //500ms or 5 minutes

    await scheduleTask("archiveAdapterTransactions", "cron", time, {});
});

registerSchedulerCallback("archiveAdapterSessions", async () => {
    logger.info("archiveAdapterSessions started");
    const scheduleAsap = await archiveSessions();

    const time = Date.now() + (scheduleAsap ? 500 : 5 * 60 * 1000); //500ms or 5 minutes

    await scheduleTask("archiveAdapterSessions", "cron", time, {});
});
