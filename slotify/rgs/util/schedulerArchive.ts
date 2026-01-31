import {registerSchedulerCallback, scheduleTask} from "@slotify/shared/lib/scheduler";
import logger from "@slotify/shared/lib/logger";
import {archiveMultiplayer, archiveSinglePlayer} from "../route/archive";

export function registerArchiveCallbacks(): void {
    registerSchedulerCallback("archiveRgsSinglePlayer", async () => {
        logger.info("archiveRgsSinglePlayer started");
        const scheduleAsap = await archiveSinglePlayer();

        const time = Date.now() + (scheduleAsap ? 500 : 5 * 60 * 1000); // 500ms or 5 minutes

        await scheduleTask("archiveRgsSinglePlayer", "cron", time, {});
    });

    registerSchedulerCallback("archiveRgsMultiPlayer", async () => {
        logger.info("archiveRgsMultiPlayer started");
        const scheduleAsap = await archiveMultiplayer();

        const time = Date.now() + (scheduleAsap ? 500 : 5 * 60 * 1000); // 500ms or 5 minutes

        await scheduleTask("archiveRgsMultiPlayer", "cron", time, {});
    });
}
