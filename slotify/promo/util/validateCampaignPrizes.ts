import Exception from "@slotify/shared/lib/Exception";
import isInt from "./isInt";
import {round} from "@slotify/shared/lib/round";

export type IPrizeConfig = {
    type: "cash" | "item" | "multiplier";
    value: number | string;
    amount: number;
    limit: number;
};

export default function validateCampaignPrizes(prizes: IPrizeConfig[]) {
    if (!prizes || !prizes.length) throw new Exception("This campaign requires at least one Prize to be configured");

    prizes.forEach(prize => {
        if (!prize.type || !["cash", "item", "multiplier"].includes(prize.type)) throw new Exception("Prize needs to have type correctly configured");
        if (prize.type !== "item" && !prize.value) throw new Exception("Prize needs to have value correctly configured");
        if (!prize.amount || !isInt(prize.amount)) throw new Exception("Prize needs to have amount correctly configured");

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
    });
}
