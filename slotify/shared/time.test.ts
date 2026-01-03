import {getPreviousDayInTimezone, getInTimezone} from "./time";

describe("getPreviousDayInTimezone", () => {
    it("should return the previous day's start and end in the given timezone", () => {
        // 2024-06-24T12:00:00Z in UTC
        const utcTimestamp = Date.UTC(2024, 5, 24, 12, 0, 0);
        const timezone = "America/New_York";
        const result = getPreviousDayInTimezone(utcTimestamp, timezone);
        const expectedStart = "2024-06-23T04:00:00.000Z";
        const expectedEnd = "2024-06-24T03:59:59.999Z";
        expect(result).toEqual({start: expectedStart, end: expectedEnd});
    });

    it("should handle timezones with positive offsets", () => {
        const utcTimestamp = Date.UTC(2024, 0, 2, 3, 0, 0); // 2024-01-02T03:00:00Z
        const timezone = "Asia/Tokyo";
        const result = getPreviousDayInTimezone(utcTimestamp, timezone);
        const expectedStart = "2023-12-31T15:00:00.000Z";
        const expectedEnd = "2024-01-01T14:59:59.999Z";
        expect(result).toEqual({start: expectedStart, end: expectedEnd});
    });

    it("should handle UTC timezone", () => {
        const utcTimestamp = Date.UTC(2024, 2, 10, 0, 0, 0); // 2024-03-10T00:00:00Z
        const timezone = "UTC";
        const result = getPreviousDayInTimezone(utcTimestamp, timezone);
        const expectedStart = "2024-03-09T00:00:00.000Z";
        const expectedEnd = "2024-03-09T23:59:59.999Z";
        expect(result).toEqual({start: expectedStart, end: expectedEnd});
    });

    it("should handle invalid timezone gracefully", () => {
        const utcTimestamp = Date.UTC(2024, 5, 24, 12, 0, 0);
        const invalidTimezone = "Invalid/Timezone";

        // With nullish coalescing, invalid timezones return undefined
        const result = getPreviousDayInTimezone(utcTimestamp, invalidTimezone);

        expect(result.start).toBeUndefined();
        expect(result.end).toBeUndefined();
    });

    it("should handle invalid utcTimestamp (NaN)", () => {
        const invalidTimestamp = NaN;
        const timezone = "America/New_York";

        // NaN timestamps return undefined with nullish coalescing
        const result = getPreviousDayInTimezone(invalidTimestamp, timezone);

        expect(result.start).toBeUndefined();
        expect(result.end).toBeUndefined();
    });

    it("should handle invalid utcTimestamp (null)", () => {
        const invalidTimestamp = null as any;
        const timezone = "America/New_York";

        // Luxon throws an error for null timestamps
        expect(() => {
            getPreviousDayInTimezone(invalidTimestamp, timezone);
        }).toThrow("fromMillis requires a numerical input");
    });

    it("should handle invalid utcTimestamp (undefined)", () => {
        const invalidTimestamp = undefined as any;
        const timezone = "America/New_York";

        // Luxon throws an error for undefined timestamps
        expect(() => {
            getPreviousDayInTimezone(invalidTimestamp, timezone);
        }).toThrow("fromMillis requires a numerical input");
    });

    it("should handle empty timezone string", () => {
        const utcTimestamp = Date.UTC(2024, 5, 24, 12, 0, 0);
        const emptyTimezone = "";

        // Empty timezone returns undefined with nullish coalescing
        const result = getPreviousDayInTimezone(utcTimestamp, emptyTimezone);

        expect(result.start).toBeUndefined();
        expect(result.end).toBeUndefined();
    });

    it("should handle null timezone", () => {
        const utcTimestamp = Date.UTC(2024, 5, 24, 12, 0, 0);
        const nullTimezone = null as any;

        // Luxon treats null as local timezone, so this should work
        const result = getPreviousDayInTimezone(utcTimestamp, nullTimezone);

        expect(typeof result.start).toBe("string");
        expect(typeof result.end).toBe("string");
        expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
});

describe("getInTimezone", () => {
    it("should return a moment object in the given timezone", () => {
        const utcTimestamp = Date.UTC(2024, 5, 24, 12, 0, 0);
        const timezone = "Europe/London";
        const result = getInTimezone(utcTimestamp, timezone);
        const expectedISO = "2024-06-24T12:00:00.000Z";
        const expectedZone = "Europe/London";
        expect(result.toUTC().toISO()).toBe(expectedISO);
        expect(result.zoneName).toBe(expectedZone);
    });

    it("should handle timezones with negative offsets", () => {
        const utcTimestamp = Date.UTC(2024, 5, 24, 12, 0, 0);
        const timezone = "America/Los_Angeles";
        const result = getInTimezone(utcTimestamp, timezone);
        const expectedISO = "2024-06-24T12:00:00.000Z";
        expect(result.toUTC().toISO()).toBe(expectedISO);
    });
});
