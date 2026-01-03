import {v5, validate} from "uuid";
import {Transaction} from "../db/model/Transaction";

const namespace = "9967414e-3b22-47b7-9638-5453578c5536";

export async function getRoundId(rgs: string, roundId: string) {
    if (!validate(roundId) && !(await Transaction.findOneBy({roundId}))) {
        return v5(rgs + "_" + roundId, namespace);
    }
    return roundId;
}

export function getTransactionId(rgs: string, rgsTransactionId: string) {
    return v5(rgs + "_" + rgsTransactionId, namespace);
}
