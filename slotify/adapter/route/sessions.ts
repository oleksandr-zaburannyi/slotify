import {Transaction} from "../db/model/Transaction";
import {Session} from "../db/model/Session";
import Exception from "@slotify/shared/lib/Exception";

export default async function sessions(roundId?: string, sessionId?: string) {
    if (roundId) {
        const transaction = await Transaction.findOne({where: {roundId, sessionId}, order: {createdAt: "ASC"}});
        if (!transaction) throw new Exception("Session couldn't be found", {data: {roundId, sessionId}});
        sessionId = transaction.sessionId;
    }
    return (await Session.findOneBy({sessionId})) || {};
}
