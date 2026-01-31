import Exception from "@slotify/shared/lib/Exception";
import isInt from "./isInt";
import {round} from "@slotify/shared/lib/round";

export function validateCurrencyOverrides(overrides: Record<string, number> | undefined, fieldName: string) {
    if (!overrides) return;

    for (const [currency, value] of Object.entries(overrides)) {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
            throw new Exception(`${fieldName} override for ${currency} must be a finite positive number`);
        }
    }
}

export type IPrizeConfig = {
    type: "cash" | "item" | "multiplier";
    value: number | string;
    amount: number;
    limit: number;
    weight?: number;
    translations?: Record<string, string>;
    currencyOverrides?: Record<string, number>;
};

export default function validateCampaignPrizes(prizes: IPrizeConfig[]) {
    if (!prizes || !prizes.length) throw new Exception("This campaign requires at least one Prize to be configured");

    prizes.forEach(prize => {
        if (!prize.type || !["cash", "item", "multiplier"].includes(prize.type)) throw new Exception("Prize needs to have type correctly configured");
        if (prize.type !== "item" && !prize.value) throw new Exception("Prize needs to have value correctly configured");
        if (!prize.amount || !isInt(prize.amount)) throw new Exception("Prize needs to have amount correctly configured");

        if (prize.weight !== undefined && (!Number.isInteger(prize.weight) || prize.weight < 1)) {
            throw new Exception("Prize weight must be a positive integer");
        }

        if (prize.type === "cash" && (typeof prize.value !== "number" || round(prize.value) !== prize.value)) {
            throw new Exception("Prize has inconsistent prize type and value");
        }

        if (prize.type === "multiplier") {
            if (!Number.isInteger(prize.value)) {
                throw new Exception("Prize has inconsistent prize type and value");
            }

            if (prize.limit != null && (typeof prize.limit !== "number" || round(prize.limit) !== prize.limit)) {
                throw new Exception(`Multiplier prize has incorrect limit ${prize.limit}`);
            }
        }

        if (prize.type === "item" && typeof prize.value !== "string") {
            throw new Exception("Prize has inconsistent prize type and value");
        }

        if (prize.currencyOverrides) {
            if (prize.type === "item") {
                throw new Exception("Currency overrides cannot be defined for item prizes");
            }

            validateCurrencyOverrides(prize.currencyOverrides, "Prize");
        }
    });

    // Validate total weighted pool doesn't exceed RNG limit (2^32)
    const totalWeighted = prizes.reduce((sum, p) => sum + p.amount * (p.weight ?? 1), 0);
    if (totalWeighted > 2 ** 32) {
        throw new Exception("Total weighted prize pool exceeds maximum allowed value");
    }
}
