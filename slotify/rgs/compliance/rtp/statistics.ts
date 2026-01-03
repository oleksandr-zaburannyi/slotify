import sum from "@slotify/shared/lib/sum";

const precisionMapper = (value: number) => Number(value.toFixed(8));

export function mean(sample: number[]): number | undefined {
    if (sample.length < 1) {
        return undefined;
    }

    return precisionMapper(sum(sample) / sample.length);
}

export function sampleVariance(sample: number[], sampleMean: number | undefined = mean(sample)): number | undefined {
    if (sample.length <= 1) {
        return undefined;
    }

    const variance = sample.reduce((sumOfSquares, value) => sumOfSquares + (value - sampleMean!) * (value - sampleMean!), 0) / (sample.length - 1);

    return precisionMapper(variance);
}

export interface SampleStatistics {
    count: number;
    mean?: number; // undefined only if count = 0
    variance?: number; // undefined only if count <= 1
}

export function calculateSampleStatistics(sample: number[]): SampleStatistics {
    const sampleMean = mean(sample);

    return {
        count: sample.length,
        mean: sampleMean,
        variance: sampleVariance(sample, sampleMean),
    };
}

// Welford's Online Algorithm for calculating variance of a sample extended by one data point:
// https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm
function combineSampleWithDataPoint(sample: SampleStatistics, value: number): SampleStatistics {
    if (sample.count <= 0) {
        return calculateSampleStatistics([value]);
    }

    if (sample.count === 1) {
        return calculateSampleStatistics([sample.mean!, value]);
    }

    const count = sample.count + 1;
    const delta = value - sample.mean!;
    const mean = (sample.count * sample.mean! + value) / count;
    const delta2 = value - mean;
    const variance = (sample.variance! * (sample.count - 1) + delta * delta2) / (count - 1);

    return {
        count,
        mean: precisionMapper(mean),
        variance: precisionMapper(variance),
    };
}

// Algorithm for combining variance of two samples based on calculus discussed here:
// https://math.stackexchange.com/questions/2971315/how-do-i-combine-standard-deviations-of-two-groups/2971563#2971563
export function combineTwoSamplesStatistics(sample1: SampleStatistics, sample2: SampleStatistics): SampleStatistics {
    if (sample2.count > sample1.count) {
        const temp = sample1;
        sample1 = sample2;
        sample2 = temp;
    }

    if (sample2.count === 0) {
        return sample1;
    }

    if (sample2.count === 1) {
        return combineSampleWithDataPoint(sample1, sample2.mean!);
    }

    return {
        count: sample1.count + sample2.count,
        mean: precisionMapper((sample1.mean! * sample1.count + sample2.mean! * sample2.count) / (sample1.count + sample2.count)),
        variance: precisionMapper(
            ((sample1.count - 1) * sample1.variance! + (sample2.count - 1) * sample2.variance!) / (sample1.count + sample2.count - 1) +
                (sample1.count * sample2.count * Math.pow(sample1.mean! - sample2.mean!, 2)) / ((sample1.count + sample2.count) * (sample1.count + sample2.count - 1)),
        ),
    };
}

export function combineSamplesStatistics(samples: SampleStatistics[]): SampleStatistics {
    return samples.reduce((combined, sample) => combineTwoSamplesStatistics(combined, sample), {count: 0});
}

const zValues = {
    80: 1.282,
    85: 1.44,
    90: 1.645,
    95: 1.96,
    99: 2.576,
    99.5: 2.807,
    99.9: 3.291,
};

export function calculateSampleMarginOfError(sampleStatistics: SampleStatistics, confidenceLevel: 80 | 85 | 90 | 95 | 99 | 99.5 | 99.9) {
    if (sampleStatistics.count <= 1) {
        return undefined;
    }

    return precisionMapper(zValues[confidenceLevel] * Math.sqrt(sampleStatistics.variance! / sampleStatistics.count));
}
