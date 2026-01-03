import {payPrizes, savePrizes} from "./prizes";
import {getNextCronTimestamp, registerSchedulerCallback, scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {CampaignPrize} from "../db/model/CampaignPrize";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {CampaignState} from "../db/model/CampaignState";
import {Campaign} from "../db/model/Campaign";
import {getTool} from "../tools/tools";
import logger from "@slotify/shared/lib/logger";
import {lazyLoadState, saveState} from "./states";
import {insertLogs} from "./routes";
import {stopStream} from "./streams";

export async function scheduleCampaignFinish({campaignId, end}: Pick<Campaign, "campaignId" | "end">) {
    if (end) {
        await scheduleTask("finishCampaign", campaignId, end.getTime(), {campaignId});
    } else {
        await unscheduleCampaignFinish(campaignId);
    }
}

export async function unscheduleCampaignFinish(campaignId: string) {
    await unsheduleTask("finishCampaign", campaignId);
}

async function schedulePromoPayouts() {
    await scheduleTask("autoPay", "cron", getNextCronTimestamp("0 * * * *"), {});
}

export default async function scheduledTasks(): Promise<void> {
    await schedulePromoPayouts();
}

registerSchedulerCallback("autoPay", async () => {
    const prizes = await CampaignPrize.getToPay();
    await payPrizes(prizes);
    await schedulePromoPayouts();
});

registerSchedulerCallback(
    "finishCampaign",
    async ({campaignId}) => {
        const campaign = await Campaign.findOneBy({campaignId});
        if (!campaign) {
            return;
        }
        const campaignState = await CampaignState.findOneByOrFail({campaignId});
        if (campaignState.ended) {
            return;
        }
        const {type, config} = campaign;
        const tool = getTool(type);
        logger.info(`Finishing campaign ${campaignId}`);

        await stopStream(type, campaignId);

        const prizes: CampaignPrize[] = [];
        await getConnection("primary").transaction(async manager => {
            if (tool.campaignEnd) {
                const {loadCampaignState} = lazyLoadState(manager, campaignId, null);
                const result = (await tool.campaignEnd({config, loadCampaignState})) || {};
                await saveState(manager, campaignId, null, result.campaignState, null);
                if (result.prizes) {
                    prizes.push(...(await savePrizes(manager, result.prizes, campaignId)));
                }
                if (result.logs) {
                    await insertLogs(manager, campaignId, result.logs);
                }
            }
            await manager.update(CampaignState, {campaignId}, {ended: true});
        });
        await payPrizes(prizes);
    },
    {once: true},
);

export async function cleanupScheduledTasks() {
    try {
        await unsheduleTask("autoPay", "cron");
    } catch (error) {
        logger.warn("Failed to unschedule autoPay task", error);
    }
}
