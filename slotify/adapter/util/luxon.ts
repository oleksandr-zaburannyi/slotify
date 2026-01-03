import {Duration as OriginalDuration, ToHumanDurationOptions, Settings} from "luxon";

// Set UTC as the default zone
Settings.defaultZone = "utc";

// Extend the original options interface with showZeros
export interface ExtendedToHumanOptions extends ToHumanDurationOptions {
    showZeros?: boolean;
}

// Extend the global Duration type to include showZeros in toHuman
declare module "luxon" {
    interface Duration {
        toHuman(opts?: ExtendedToHumanOptions): string;
    }
}

// Store original toHuman method
const originalToHuman = OriginalDuration.prototype.toHuman;

// Check if already patched by comparing function references
if (OriginalDuration.prototype.toHuman === originalToHuman) {
    OriginalDuration.prototype.toHuman = function (opts: ExtendedToHumanOptions = {}) {
        // If showZeros is false, filter out zero-value units
        if (opts.showZeros === false) {
            const orderedUnits = ["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds"] as const;
            const nonZeroUnits = orderedUnits.filter(unit => (this as any).values[unit] !== undefined && (this as any).values[unit] !== 0);
            // Only include non-zero units in the output
            const {showZeros, ...otherOpts} = opts;
            return originalToHuman.call(this.shiftTo(...nonZeroUnits), otherOpts);
        }

        // Use original behavior
        return originalToHuman.call(this, opts);
    };
}

// Re-export the patched Duration class
export const Duration = OriginalDuration;

// Re-export all of Luxon
export * from "luxon";
