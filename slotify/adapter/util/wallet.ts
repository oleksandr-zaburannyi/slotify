import {Session} from "../db/model/Session";
import {Wallet} from "../db/model/Wallet";
import {Player} from "../db/model/Player";

export const isOneTimeKeyBlocked = async (walletId: string, key: string): Promise<boolean> => {
    if (!(await Wallet.isOneTimeKeyBlocked(walletId))) return false;
    if (!key) return false;

    const existingKeyCount = await Session.createQueryBuilder("session").innerJoin(Player, "player", "player.id = session.playerId").where("session.key = :key", {key}).andWhere("player.wallet = :wallet", {wallet: walletId}).getCount();
    return existingKeyCount > 0;
};
