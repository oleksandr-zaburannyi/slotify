import {getNextCronTimestamp, registerSchedulerCallback, scheduleTask} from "@slotify/shared/lib/scheduler";
import logger from "@slotify/shared/lib/logger";
import {verifyCriticalFiles} from "../compliance/critical-files/verification";
import {calculateRtps} from "../compliance/rtp/rtpResolvers";

export function registerCronCallbacks(): void {
    registerSchedulerCallback("verifyCriticalFiles", async () => {
        logger.info("verifyCriticalFiles started");
        await verifyCriticalFiles().catch(error => logger.error(error));
        await scheduleTask("verifyCriticalFiles", "cron", getNextCronTimestamp("0 6,18 * * *"), {});
    });

    registerSchedulerCallback("calculateRtps", async () => {
        logger.info("calculateRtps started");
        await calculateRtps();
        await scheduleTask("calculateRtps", "cron", getNextCronTimestamp("0 * * * *"), {});
    });
}
