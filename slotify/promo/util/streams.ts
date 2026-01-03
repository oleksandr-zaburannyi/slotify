import {getNextCronTimestamp, hasTask, registerSchedulerCallback, scheduleTask, setTaskTimestamp, synchronizedTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {IStreamEntry, StreamEntry} from "../db/model/StreamEntry";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {In, IsNull, LessThanOrEqual, MoreThan} from "typeorm";
import logger from "@slotify/shared/lib/logger";
import {CampaignState} from "../db/model/CampaignState";
import {Campaign} from "../db/model/Campaign";
import Exception from "@slotify/shared/lib/Exception";
import {StreamSnapshot} from "../db/model/StreamSnapshot";
import {getTool} from "../tools/tools";

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

    if (getTool(campaignType).snapshotCron) {
        logger.info(`Registering snapshot ${campaignType} callback`);
        registerSchedulerCallback(`streamSnapshot:${campaignType}`, ({campaignId}) => createSnapshot(campaignType, campaignId));
    }

    await rehydrateStreams(campaignType);
}

async function rehydrateStreams(type: string) {
    logger.info(`Rehydrating streams ${type}`);

    const activeAccumulatorCampaigns = await Campaign.find({
        where: [
            {
                enabled: true,
                end: IsNull(),
                type,
            },
            {
                enabled: true,
                end: MoreThan(new Date()),
                type,
            },
        ],
    });

    for (const campaign of activeAccumulatorCampaigns) {
        const {campaignId} = campaign;

        const accumulatorTaskType = `streamAccumulator:${type}`;
        if (!(await hasTask(accumulatorTaskType, campaignId))) {
            logger.info(`Rehydrating stream ${accumulatorTaskType} ${campaignId} accumulator task`);

            const campaignState = await CampaignState.findOneBy({campaignId});
            if (!campaignState || campaignState.ended || !campaignState.state) {
                logger.error(`Campaign state rehydration error ${accumulatorTaskType} ${campaignId}`, {campaignState});
                continue;
            }

            const {nextAccumulationTime} = campaignState.state;
            await scheduleTask(accumulatorTaskType, campaignId, nextAccumulationTime, {campaignId});
        }

        const snapshotTaskType = `streamSnapshot:${type}`;
        const snapshotCron = getTool(type).snapshotCron;
        if (snapshotCron && !(await hasTask(snapshotTaskType, campaignId))) {
            logger.info(`Rehydrating stream snapshot ${snapshotTaskType} ${campaignId} task`);
            const nextSnapshotTime = getNextCronTimestamp(snapshotCron);
            await scheduleTask(snapshotTaskType, campaignId, nextSnapshotTime, {campaignId});
        }
    }
}

export async function streamEntry<TEntryData>(streamId: string, data: TEntryData): Promise<IStreamEntry<TEntryData>> {
    const insertResult = await StreamEntry.insert<any>({streamId, data});
    const id = insertResult.raw[0].id;
    return {id, data};
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

    const {data, nextAccumulationTime} = await accumulator({
        config: campaign.config,
        entries,
        latestAccumulationData,
        time,
    });

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
    const accumulatorTaskType = `streamAccumulator:${campaignType}`;
    await scheduleTask(accumulatorTaskType, campaignId, nextAccumulationTime, {campaignId});

    const snapshotCron = getTool(campaignType).snapshotCron;
    if (snapshotCron) {
        const snapshotTaskType = `streamSnapshot:${campaignType}`;
        await scheduleTask(snapshotTaskType, campaignId, getNextCronTimestamp(snapshotCron), {campaignId});
    }
}

export async function stopStream(campaignType: string, campaignId: string) {
    logger.info(`Stopping stream ${campaignId}`);
    const accumulatorTaskType = `streamAccumulator:${campaignType}`;
    await unsheduleTask(accumulatorTaskType, campaignId);
    const snapshotTaskType = `streamSnapshot:${campaignType}`;
    await unsheduleTask(snapshotTaskType, campaignId);
}

export async function createSnapshot<TAccumulationData>(campaignType: string, campaignId: string) {
    logger.info(`Creating stream snapshot ${campaignId}`);
    const snapshotTaskType = `streamSnapshot:${campaignType}`;

    if (!(await hasTask(`streamAccumulator:${campaignType}`, campaignId))) {
        logger.info(`Stream accumulator for ${campaignType} ${campaignId} stopped - unscheduling snapshot`);
        await unsheduleTask(snapshotTaskType, campaignId);
        return;
    }

    const {state} = await CampaignState.findOneByOrFail({campaignId});
    const {data, index} = state as IStreamCampaignState<TAccumulationData>;

    await StreamSnapshot.insert({streamId: campaignId, accumulationIndex: index, data: data as any});

    const nextSnapshotTime = getNextCronTimestamp(getTool(campaignType).snapshotCron!);
    await setTaskTimestamp(snapshotTaskType, campaignId, nextSnapshotTime);
}

export async function generateReport<TAccumulationData>(
    campaignId: string,
    time: number,
): Promise<{
    data: TAccumulationData;
    time: number;
}> {
    logger.info(`Generating stream report ${campaignId}`);
    const date = new Date(time);

    const {type, config} = await Campaign.findOneByOrFail({campaignId});
    const {accumulator} = getTool(type);

    if (!accumulator) {
        throw new Exception(`Campaign type ${type} is stream campaign and doesn't provide reports generation`);
    }

    const replicaManager = getConnection("replica").manager;
    const snapshot = await replicaManager.findOne(StreamSnapshot, {
        where: {
            streamId: campaignId,
            createdAt: LessThanOrEqual(date),
        },
        order: {
            createdAt: "DESC",
        },
    });

    if (!snapshot) {
        throw new Exception(`Could not find a stream ${type} ${campaignId} snapshot from before the date ${date}`);
    }

    const lastEntry = await replicaManager.findOne(StreamEntry, {
        where: {
            streamId: campaignId,
            createdAt: LessThanOrEqual(date),
        },
        order: {
            createdAt: "DESC",
        },
    });

    if (!lastEntry) {
        logger.info(`No entries in a stream ${type} ${campaignId} snapshot from before the date ${date} (returning snapshot)`);
        return {data: snapshot.data as TAccumulationData, time: snapshot.createdAt.getTime()};
    }

    time = lastEntry.createdAt.getTime();
    const entries = await replicaManager.find<any>(StreamEntry, {
        where: {
            streamId: campaignId,
            processed: true,
            accumulationIndex: MoreThan(snapshot.accumulationIndex),
            id: LessThanOrEqual(lastEntry.id),
        },
        order: {id: "ASC"},
    });

    const {data} = await accumulator({
        config,
        entries,
        latestAccumulationData: snapshot.data,
        time,
    });

    return {data, time};
}
