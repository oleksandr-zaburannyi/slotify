import {Transaction} from "../db/model/Transaction";
import {In} from "typeorm";

export default async function roundBalance(roundIds: number[]) {
    const roundBalance: Record<string, {balanceBefore: number; balanceAfter?: number}> = {};
    const transactions = await Transaction.find({where: {roundId: In(roundIds)}, order: {createdAt: "ASC"}});

    for (const {type, roundId, balanceAfter, campaignType, amount} of transactions) {
        if (type === "withdraw" && roundBalance[roundId] == undefined) {
            const balanceBefore = campaignType === "freeBets" ? balanceAfter : balanceAfter + amount;
            roundBalance[roundId] = {balanceBefore};
        }
        if (type === "deposit") {
            roundBalance[roundId].balanceAfter = balanceAfter;
        }
    }
    return {roundBalance};
}
