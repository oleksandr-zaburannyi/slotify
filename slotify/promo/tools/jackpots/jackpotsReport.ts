import {getInTimezone, getPreviousDayInTimezone} from "@slotify/shared/lib/time";
import {IJackpotAccumulationData} from "./jackpots";
import {generateReport} from "../../util/streams";

export async function DGE_jackpot(
    campaignId: string,
    timestamp: number,
): Promise<
    {
        poolName: string;
        start: Date;
        startAmount: number;
        startSeedAmount: number;
        end: Date;
        endAmount: number;
        endSeedAmount: number;
    }[]
> {
    const {start, end} = getPreviousDayInTimezone(timestamp, "America/New_York");
    const startReport = await generateReport<IJackpotAccumulationData>(campaignId, new Date(start!).getTime());
    const startPoolAmounts = startReport.data._poolAmounts;
    const endReport = await generateReport<IJackpotAccumulationData>(campaignId, new Date(end!).getTime());
    const endPoolAmounts = endReport.data._poolAmounts;

    return Object.keys(startPoolAmounts).map(poolName => ({
        poolName,
        start: getInTimezone(startReport.time, "America/New_York").toISO(),
        startAmount: startPoolAmounts[poolName].amount,
        startSeedAmount: startPoolAmounts[poolName].seedAmount,
        end: getInTimezone(endReport.time, "America/New_York").toISO(),
        endAmount: endPoolAmounts[poolName].amount,
        endSeedAmount: endPoolAmounts[poolName].seedAmount,
    }));
}
