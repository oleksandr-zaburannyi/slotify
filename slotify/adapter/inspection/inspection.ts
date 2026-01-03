import {ITransaction} from "../walletAdapter/IWalletAdapter";
import {Transaction} from "../db/model/Transaction";
import {Player} from "../db/model/Player";
import {alerting} from "./alerting";
import {validation} from "./validation";
import {verification} from "./verification";
import cache from "@slotify/shared/lib/cache";
import {Rgs} from "../db/model/Rgs";
import {Wallet} from "../db/model/Wallet";
import {deepObjectAssign} from "@slotify/shared/lib/deepObjectAssign";
import {Game} from "../db/model/Game";

const getConfig = cache(
    5 * 60,
    async (rgsId: string, walletId: string, gameId?: string) => {
        const rgs = await Rgs.findOneBy({id: rgsId});
        const game = gameId ? await Game.findOneBy({game: gameId}) : null;
        const wallet = await Wallet.findOneBy({id: walletId});
        return deepObjectAssign({}, rgs?.inspectionConfig, game?.inspectionConfig, wallet?.inspectionConfig);
    },
    ["rgss", "wallets", "games"],
);

export async function inspection(transactionId: string, transaction: ITransaction, player: Player, isPlayerExcluded: boolean) {
    const transactions = await Transaction.find({where: {roundId: transaction.roundId}, order: {createdAt: "ASC"}});

    const config = await getConfig(transaction.rgs, player.wallet, transaction.game);
    await validation(config.validation || {}, transactionId, transaction, transactions);
    await alerting(config.alerting || {}, transaction, transactions, player, isPlayerExcluded);
    await verification(config.verification || {}, transaction, transactions, player, isPlayerExcluded);
}
