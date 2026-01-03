import {DateTime} from "luxon";

export function getPreviousDayInTimezone(utcTimestamp: number, timezone: string) {
    const dt = DateTime.fromMillis(utcTimestamp, {zone: "utc"}).setZone(timezone).minus({days: 1});
    return {
        start: dt.startOf("day").toUTC().toISO() ?? undefined,
        end: dt.endOf("day").toUTC().toISO() ?? undefined,
    };
}

export function getInTimezone(utcTimestamp: number, timezone: string) {
    return DateTime.fromMillis(utcTimestamp, {zone: "utc"}).setZone(timezone);
}
