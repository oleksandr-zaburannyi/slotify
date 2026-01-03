import {SampleStatistics} from "./statistics";
import {selectSampleStatistics} from "./selectSampleStatistics";

export interface SampleLog extends SampleStatistics {
    startDate: Date;
    endDate: Date;
}

export async function updateSamplesLog(game: string, variant: string | undefined, samples: SampleLog[] = []): Promise<SampleLog[]> {
    const now = new Date();

    samples = removeOldSamples(samples, now);

    const startDate = samples.length > 0 ? samples[samples.length - 1].endDate : getOneHourBefore(now);

    const sampleStatistics = await selectSampleStatistics(game, variant, startDate, now);

    samples.push({...sampleStatistics, startDate, endDate: now});

    return samples;
}

function removeOldSamples(samples: SampleLog[], now: Date) {
    const twoWeeksAgo = getTwoWeeksBefore(now);

    let index = 0;
    while (samples.length > index && samples[index].endDate <= twoWeeksAgo) {
        index++;
    }

    return samples.slice(index, samples.length);
}

function getTwoWeeksBefore(date: Date): Date {
    return new Date(date.getTime() - 14 * 24 * 60 * 60 * 1000);
}

function getOneHourBefore(date: Date): Date {
    return new Date(date.getTime() - 60 * 60 * 1000);
}
