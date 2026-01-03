import {redis} from "./redis";
import {v4} from "uuid";
import logger from "./logger";
import CronExpressionParser from "cron-parser";
import {startCorrelation} from "./asyncContext";
import Exception from "./Exception";
import {hasLock, lock, unlock} from "./lock";
import wait from "./wait";
import {executeInQueue} from "./queue";

type ICallback = (data: any) => Promise<any>;
const callbacks: Record<string, {callback: ICallback; options: IOptions}> = {};

type IOptions = {
    timeout?: number;
    once?: boolean;
    parallelTasksLimit?: number;
};

export function registerSchedulerCallback(taskType: string, callback: ICallback, options: IOptions = {}) {
    callbacks[taskType] = {callback, options};
}

async function getUrgentTasks(taskType: string, count: number): Promise<{taskId: string; timestamp: number}[]> {
    const results = await redis.zRangeWithScores(`scheduler:${taskType}:tasks`, 0, Date.now(), {
        BY: "SCORE",
        LIMIT: {offset: 0, count},
    });

    return (results || []).map(({value, score}) => ({taskId: value, timestamp: score}));
}

const lockId = (taskType: string, taskId: string) => `scheduler:${taskType}:lock:${taskId}`;

export async function isTaskBeingProcessed(taskType: string, taskId: string) {
    return await hasLock(lockId(taskType, taskId));
}

async function getTaskData(taskType: string, taskId: string) {
    const data = await redis.get(`scheduler:${taskType}:data:${taskId}`);
    return data && JSON.parse(data);
}

export async function scheduleTask(taskType: string, taskId: string, timestamp: number, data: any) {
    if (!data) {
        throw new Exception("Scheduled task data needs to be provided", {data: {taskType, taskId, timestamp}});
    }
    await redis.set(`scheduler:${taskType}:data:${taskId}`, JSON.stringify(data));
    await redis.zAdd(`scheduler:${taskType}:tasks`, {score: timestamp, value: taskId});
}

export async function hasTask(taskType: string, taskId: string) {
    return !!(await redis.get(`scheduler:${taskType}:data:${taskId}`));
}

export async function unsheduleTask(taskType: string, taskId: string) {
    await redis.zRem(`scheduler:${taskType}:tasks`, taskId);
    await redis.del(`scheduler:${taskType}:data:${taskId}`);
}

export async function scheduleInstant(taskType: string, taskId: string) {
    await lock(lockId(taskType, taskId + "-instant"), 60000);
    await setTaskTimestamp(taskType, taskId, Date.now(), true);
}

export async function setTaskTimestamp(taskType: string, taskId: string, timestamp: number, skipLock = false) {
    if (!skipLock && (await hasLock(lockId(taskType, taskId + "-instant")))) return;
    await redis.zAdd(`scheduler:${taskType}:tasks`, {score: timestamp, value: taskId});
}

async function processTask(taskType: string, taskId: string, callback: ICallback, timeout: number, once: boolean) {
    await unlock(lockId(taskType, taskId + "-instant"));
    const timeoutTimestamp = Date.now() + timeout;
    await setTaskTimestamp(taskType, taskId, timeoutTimestamp);
    const data = await getTaskData(taskType, taskId);

    if (!data) {
        await unsheduleTask(taskType, taskId);
        throw new Exception(`Scheduled task data is missing - unscheduling task (${taskType})`, {data: {taskType}});
    }

    await callback(data);

    if (Date.now() > timeoutTimestamp) {
        logger.warn(`Task callback finished after releasing lock (${taskType})`, {
            taskType,
            taskId,
            timeout,
            timeoutTimestamp,
        });
    }

    if (once) {
        await unsheduleTask(taskType, taskId);
    }
}

export function initScheduler(pollingInterval: number) {
    for (const [taskType, {callback, options}] of Object.entries(callbacks)) {
        const parallelTasksLimit = options.parallelTasksLimit || 1;
        const timeout = options.timeout || 60 * 1000;
        const once = options.once || false;

        const tasksInProgress = new Set<string>();

        const taskTypeLoop = async () => {
            let tasks;
            if (redis.isReady) {
                const taskCount = parallelTasksLimit - tasksInProgress.size;
                tasks = await getUrgentTasks(taskType, taskCount);

                tasks.forEach(task => {
                    const {taskId} = task;
                    const tryProcessTask = async () => {
                        if (await lock(lockId(taskType, taskId), timeout)) {
                            const actualUrgentTasks = await getUrgentTasks(taskType, tasks.length);
                            const isStillUrgent = actualUrgentTasks.some(actualUrgentTask => actualUrgentTask.taskId === taskId);

                            if (isStillUrgent) {
                                const store = {correlationId: v4(), sessionId: taskId};
                                try {
                                    await startCorrelation(store, async () => await processTask(taskType, taskId, callback, timeout, once));
                                } catch (error) {
                                    logger.warn(`Task failed (${taskType})`, {error, taskType, taskId});
                                }
                            } else {
                                logger.info(`Scheduler tasks queue was altered while awaiting for lock (${taskType})`, {
                                    task,
                                    actualUrgentTasks,
                                });
                            }

                            await unlock(lockId(taskType, taskId));
                        }
                    };

                    tasksInProgress.add(taskId);
                    tryProcessTask()
                        .catch(e => logger.error(`Task ${taskType} execution failed failed, taskId ${taskId}`, {error: e}))
                        .finally(() => tasksInProgress.delete(taskId));
                });
            }

            if (isRunning) {
                const hasPendingTasks = tasksInProgress.size === parallelTasksLimit;
                const fastPollingInterval = 10;
                const timeout = hasPendingTasks ? fastPollingInterval : pollingInterval;
                setTimeout(taskTypeLoop, timeout);
            }
        };

        taskTypeLoop().catch(e => {
            logger.error(`Scheduler task type failed (${taskType})`, {error: e});
        });
    }
}

export function stopScheduler() {
    isRunning = false;
}

export function getNextCronTimestamp(cronExpression: string) {
    const interval = CronExpressionParser.parse(cronExpression);
    return interval.next().getTime();
}

export function validateCron(cronExpression: string) {
    try {
        CronExpressionParser.parse(cronExpression);
        return true;
    } catch {
        return false;
    }
}

export async function synchronizedTask<T>(taskType: string, taskId: string, callback: () => Promise<T>, timeoutSeconds: number = 60): Promise<T> {
    return await executeInQueue(`synchronized-tasks-queue:${taskType}:${taskId}`, async () => {
        const pollingStart = Date.now();
        const pollingInterval: number = 50;
        const expiryMs = timeoutSeconds * 1000;

        let obtainedLockId = await lock(lockId(taskType, taskId), expiryMs);
        while (!obtainedLockId && Date.now() - pollingStart < expiryMs) {
            await wait(pollingInterval);
            obtainedLockId = await lock(lockId(taskType, taskId), expiryMs);
        }

        if (!obtainedLockId) {
            throw new Exception("Unable to acquire synchronizedTask lock", {
                data: {
                    taskType,
                    taskId,
                    pollingStart,
                    timeoutSeconds,
                },
            });
        }

        try {
            return await callback();
        } catch (e) {
            logger.warn(`Task failed (${taskType})`, {error: e, taskType, taskId});
            throw e;
        } finally {
            await unlock(lockId(taskType, taskId));
        }
    });
}

let isRunning = true;
process.on("SIGTERM", () => {
    stopScheduler();
});
