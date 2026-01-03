import {hasTask, registerSchedulerCallback, scheduleTask, setTaskTimestamp, synchronizedTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {IStreamEntry, StreamEntry} from "../db/model/StreamEntry";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {In, IsNull, MoreThan} from "typeorm";
import logger from "@slotify/shared/lib/logger";
import {CampaignState} from "../db/model/CampaignState";
import {Campaign} from "../db/model/Campaign";
import {tools} from "../tools/tools";
import Exception from "@slotify/shared/lib/Exception";

export type IStreamCampaignState<TAccumulationData> = {
    data: TAccumulationData;
    index: number;
    nextAccumulationTime: number;
};

export type IStreamAccumulator<TConfig, TEntryData, TAccumulationData> = (request: {
    config: TConfig;
    entries: IStreamEntry<TEntryData>[];
    latestAccumulationData: TAccumulationData;
    time: number;
}) => Promise<{data: TAccumulationData; nextAccumulationTime: number}>;

export type IStreamSynchronizedAccumulator<TConfig = any, TEntryData = any, TAccumulationData = any> = (
    accumulator: IStreamAccumulator<TConfig, TEntryData, TAccumulationData>,
) => Promise<{data: TAccumulationData; nextAccumulationTime: number}>;

export async function initStreams<TConfig, TEntryData, TAccumulationData>(campaignType: string, accumulator: IStreamAccumulator<TConfig, TEntryData, TAccumulationData>) {
    logger.info(`Registering stream ${campaignType} callback`);
    registerSchedulerCallback(`streamAccumulator:${campaignType}`, ({campaignId}) => accumulateStream(campaignType, campaignId, accumulator));
    await rehydrateAccumulators(campaignType);
}

async function rehydrateAccumulators(streamType: string) {
    logger.info(`Rehydrating stream ${streamType} accumulators`);

    const streamCampaignTypes = Object.entries(tools)
        .filter(([, tool]) => tool.accumulator)
        .map(([type]) => type);

    const activeAccumulatorCampaigns = await Campaign.find({
        where: [
            {
                enabled: true,
                end: IsNull(),
                type: In(streamCampaignTypes),
            },
            {
                enabled: true,
                end: MoreThan(new Date()),
                type: In(streamCampaignTypes),
            },
        ],
    });

    for (const campaign of activeAccumulatorCampaigns) {
        const {campaignId, type} = campaign;

        const taskType = `streamAccumulator:${type}`;
        if (!(await hasTask(taskType, campaignId))) {
            logger.info(`Rehydrating stream ${taskType} ${campaignId} accumulator task`);

            const campaignState = await CampaignState.findOneBy({campaignId});
            if (!campaignState || campaignState.ended || !campaignState.state) {
                logger.error(`Campaign state rehydration error ${taskType} ${campaignId}`, {campaignState});
                continue;
            }

            const {nextAccumulationTime} = campaignState.state;
            await scheduleTask(taskType, campaignId, nextAccumulationTime, {campaignId});
        }
    }
}

export async function accumulateStream<TConfig, TEntryData, TAccumulationData>(
    campaignType: string,
    campaignId: string,
    accumulator: IStreamAccumulator<TConfig, TEntryData, TAccumulationData>,
): Promise<IStreamCampaignState<TAccumulationData>> {
    logger.info(`Accumulating stream ${campaignType} ${campaignId}`);
    const taskType = `streamAccumulator:${campaignType}`;
    const time = Date.now();

    const campaign = await Campaign.findOneBy({campaignId});
    if (!campaign || !campaign.enabled || (campaign.end && campaign.end.getTime() < Date.now())) {
        await unsheduleTask(taskType, campaignId);
        throw new Exception("Stream scheduled accumulator called for inactive campaign (unscheduling)", {data: {campaign}});
    }

    const campaignState = await CampaignState.findOneByOrFail({campaignId});
    const {data: latestAccumulationData, index: latestAccumulationIndex} = campaignState.state as IStreamCampaignState<TAccumulationData>;

    const entries: IStreamEntry<TEntryData>[] = await StreamEntry.find<any>({
        where: {streamId: campaignId, processed: false},
        order: {id: "ASC"},
        take: 10000,
    });
    const processedEntriesIds = entries.map(entry => entry.id);

    const {data, nextAccumulationTime} = await accumulator({config: campaign.config, entries, latestAccumulationData, time});

    const index = latestAccumulationIndex + 1;

    await getConnection("primary").transaction(async manager => {
        const state: any = {data, index, nextAccumulationTime};
        await manager.update(CampaignState, {campaignId}, {state});

        if (processedEntriesIds.length) {
            await manager.update(
                StreamEntry,
                {
                    streamId: campaignId,
                    processed: false,
                    id: In(processedEntriesIds),
                },
                {processed: true, accumulationIndex: index},
            );
        }
    });

    await setTaskTimestamp(taskType, campaignId, nextAccumulationTime);

    logger.info(`Accumulation finished stream ${campaignType} ${campaignId}`);
    return {data, index, nextAccumulationTime};
}

export async function accumulateStreamSynchronously<TConfig, TEntryData, TAccumulationData>(campaignType: string, campaignId: string, accumulator: IStreamAccumulator<TConfig, TEntryData, TAccumulationData>) {
    const taskType = `streamAccumulator:${campaignType}`;
    return await synchronizedTask(taskType, campaignId, async () => await accumulateStream(campaignType, campaignId, accumulator));
}

export async function startStream(campaignType: string, campaignId: string, nextAccumulationTime: number) {
    logger.info(`Starting stream ${campaignType} ${campaignId}`);
    const taskType = `streamAccumulator:${campaignType}`;
    await scheduleTask(taskType, campaignId, nextAccumulationTime, {campaignType, campaignId});
}

export async function stopStream(campaignType: string, campaignId: string) {
    logger.info(`Stopping stream ${campaignId}`);
    const taskType = `streamAccumulator:${campaignType}`;
    await unsheduleTask(taskType, campaignId);
}

export async function streamEntry<TEntryData>(streamId: string, data: TEntryData): Promise<IStreamEntry<TEntryData>> {
    const insertResult = await StreamEntry.insert<any>({streamId, data});
    const id = insertResult.raw[0].id;
    return {id, data};
}
