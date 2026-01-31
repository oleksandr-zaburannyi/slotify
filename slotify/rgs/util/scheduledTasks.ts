import {getNextCronTimestamp, scheduleTask} from "@slotify/shared/lib/scheduler";
import {registerRehydrateCallback} from "./schedulerRehydration";
import {registerRetryCallbacks} from "./schedulerRetry";
import {registerCronCallbacks} from "./schedulerCron";
import {registerArchiveCallbacks} from "./schedulerArchive";

export default async function scheduledTasks(): Promise<void> {
    registerCallbacks();
    await scheduleInitialTasks();
}

function registerCallbacks(): void {
    registerRehydrateCallback();
    registerRetryCallbacks();
    registerCronCallbacks();
    registerArchiveCallbacks();
}

async function scheduleInitialTasks(): Promise<void> {
    await scheduleTask("rehydrateRetries", "cron", getNextCronTimestamp("0 * * * *"), {});
    await scheduleTask("verifyCriticalFiles", "cron", getNextCronTimestamp("0 6,18 * * *"), {});
    await scheduleTask("calculateRtps", "cron", getNextCronTimestamp("0 * * * *"), {});
    await scheduleTask("archiveRgsSinglePlayer", "cron", getNextCronTimestamp("0 * * * *"), {});
    await scheduleTask("archiveRgsMultiPlayer", "cron", getNextCronTimestamp("0 * * * *"), {});
}
