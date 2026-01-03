import {RtpMonitoring} from "../../db/model/RtpMonitoring";
import {updateSamplesLog} from "./updateCalculus";
import {calculateSampleMarginOfError, combineSamplesStatistics} from "./statistics";
import Exception from "@slotify/shared/lib/Exception";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import RtpMonitoringEmailBuilder from "./RtpMoniotringEmailBuilder";
import {DeepPartial} from "typeorm";
import logger from "@slotify/shared/lib/logger";

export async function addRtpMonitoring(data: RtpMonitoring) {
    if (!data.game) {
        throw new Exception("Game name needs to be specified");
    }

    if (data.declaredRtp !== Number(data.declaredRtp) || data.declaredRtp < 0 || data.declaredRtp > 1) {
        throw new Exception("Declared RTP needs to be a number from [0,1]");
    }

    const initialSamplesLog = await updateSamplesLog(data.game, data.variant);

    const combinedStatistics = combineSamplesStatistics(initialSamplesLog);

    const marginOfError = calculateSampleMarginOfError(combinedStatistics, 99.9);

    return await RtpMonitoring.create({
        ...data,
        calculus: initialSamplesLog,
        sampleCount: combinedStatistics.count,
        sampleRtp: combinedStatistics.mean != null ? combinedStatistics.mean : null,
        sampleVariance: combinedStatistics.variance != null ? combinedStatistics.variance : null,
        sampleMarginOfError: marginOfError,
    }).save();
}

export async function editRtpMonitoring(rtpMonitoring: RtpMonitoring, data: RtpMonitoring) {
    if (rtpMonitoring.game !== data.game || rtpMonitoring.variant !== data.variant) {
        throw new Exception("Cannot edit game name or variant");
    }
    if (data.declaredRtp !== Number(data.declaredRtp) || data.declaredRtp < 0 || data.declaredRtp > 1) {
        throw new Exception("Declared RTP needs to be a number from [0,1]");
    }
    await RtpMonitoring.update({id: rtpMonitoring.id}, {declaredRtp: data.declaredRtp});
}

export async function calculateRtps() {
    const monitorings: RtpMonitoring[] = await getConnection("replica").createQueryBuilder(RtpMonitoring, "rtp_monitoring").getMany();

    const emailBuilder = new RtpMonitoringEmailBuilder();
    for (const rtpMonitoring of monitorings) {
        try {
            const samplesLog = await updateSamplesLog(rtpMonitoring.game, rtpMonitoring.variant, rtpMonitoring.calculus);
            const statistics = combineSamplesStatistics(samplesLog);
            const marginOfError = calculateSampleMarginOfError(statistics, 99.9);

            const updateEntity: DeepPartial<RtpMonitoring> = {
                calculus: samplesLog,
                sampleCount: statistics.count,
                sampleRtp: statistics.mean,
                sampleVariance: statistics.variance,
                sampleMarginOfError: marginOfError,
            };

            if (shouldSendEmail(rtpMonitoring, statistics.count, statistics.mean, marginOfError)) {
                emailBuilder.appendRtpMonitoring(rtpMonitoring, statistics, marginOfError!);
            }

            await RtpMonitoring.update({id: rtpMonitoring.id}, updateEntity);
        } catch (e) {
            logger.error("Unable to calculate RTP", {error: e});
        }
    }

    emailBuilder.trySend();
}

const relevantRtpMonitoringSample = process.env.RELEVANT_RTP_MONITORING_SAMPLE ? parseInt(process.env.RELEVANT_RTP_MONITORING_SAMPLE) : 100;

function shouldSendEmail(rtpMonitoring: RtpMonitoring, newSampleCount: number, newMean?: number, marginOfError?: number) {
    const isSampleCountRelevant = newSampleCount > relevantRtpMonitoringSample;
    const wasMismatchBefore = isMismatch(rtpMonitoring.declaredRtp, rtpMonitoring.sampleRtp, rtpMonitoring.sampleMarginOfError);
    const isMismatchNow = isMismatch(rtpMonitoring.declaredRtp, newMean, marginOfError);

    return isSampleCountRelevant && !wasMismatchBefore && isMismatchNow;
}

function isMismatch(declaredRtp: number, sampleRtp?: number | null, sampleMarginOfError?: number | null) {
    return sampleRtp != null && sampleMarginOfError != null && (declaredRtp < sampleRtp - sampleMarginOfError || declaredRtp > sampleRtp + sampleMarginOfError);
}
