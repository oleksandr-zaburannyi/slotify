import {fetchAndParse} from "@slotify/shared/lib/fetch";
import logger from "@slotify/shared/lib/logger";
import {getServiceUrl, isServiceAvailable} from "@slotify/shared/lib/urls";

interface IPromoTransaction {
    playerId: string;
    nativeId: string;
    wallet: string;
    operator: string;
    brand?: string;
    nickname?: string | null;
    transactionId: string;
    type: string;
    amount: number;
    provider?: string;
    rgs: string;
    game?: string;
    roundId: string;
    roundFinished: boolean;
    currency: string;
    jurisdiction?: string;
}

interface IPromoTransactionResponse {
    campaignId?: string;
    campaignType?: string;
    campaignData?: any;
    callFinished?: boolean;
    jackpotAmount?: number;
    data?: any;
}

export async function sendToPromo(mode: string, category: string | undefined, transaction: IPromoTransaction): Promise<IPromoTransactionResponse> {
    if (isServiceAvailable("promo") && category !== "promo") {
        const body = JSON.stringify(transaction);
        const {campaignType, campaignId, campaignData, callFinished, jackpotAmount, data} = await fetchAndParse(`${getServiceUrl("promo")}/api/transaction/${mode}`, {method: "POST", body, headers: {"Content-Type": "application/json"}});
        logger.info(`Promo transaction (${mode}) ${transaction.transactionId}`, {campaignType, campaignId});
        return {campaignId, campaignType, campaignData, callFinished, jackpotAmount, data};
    }
    return {};
}

interface IPromoPlayer {
    provider: string;
    game?: string;
    playerId: string;
    wallet: string;
    operator: string;
    brand?: string;
    nickname?: string;
    nativeId: string;
    currency: string;
    jurisdiction?: string;
    campaignTypes?: string[];
}

export async function authPromo(player: IPromoPlayer): Promise<void> {
    if (isServiceAvailable("promo")) {
        const body = JSON.stringify(player);
        await fetchAndParse(`${getServiceUrl("promo")}/api/authenticate`, {method: "POST", body, headers: {"Content-Type": "application/json"}});
    }
}
