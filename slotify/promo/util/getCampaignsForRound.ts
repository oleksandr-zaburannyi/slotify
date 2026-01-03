import {CampaignResponse} from "../db/model/CampaignResponse";
import {Campaign, CampaignData} from "../db/model/Campaign";
import logger from "@slotify/shared/lib/logger";
import {IPlayer, ITransactionResponse} from "./routes";

export async function getCampaignsForRound(player: IPlayer, roundId: string, mode: string) {
    const response: ITransactionResponse = {campaigns: []};
    let campaigns: CampaignData[] = (await Campaign.getAll(player)).filter(campaign => campaign.status === "active");

    if (mode === "deposit") {
        const transactionResponses = await CampaignResponse.findBy({roundId});

        // force activeness only for free bets campaigns
        const withdrawResponse = transactionResponses.find(transactionResponse => transactionResponse.responseId.startsWith("withdraw_") && transactionResponse.response.campaignType === "freeBets");

        if (withdrawResponse) {
            const {campaignType, campaignId, walletCampaignId, campaignData} = withdrawResponse.response;
            const activeCampaign = await Campaign.forceActive(campaignId!);

            // remove active campaign if exists
            campaigns = campaigns.filter(campaign => campaign.type !== campaignType);

            if (activeCampaign) {
                // append forced active campaign
                campaigns.push(activeCampaign);
            } else {
                logger.warn("Campaign was deleted during players round (repeating last response data)", {
                    campaignId,
                });
                response.campaignType = campaignType;
                response.campaignId = campaignId;
                response.walletCampaignId = walletCampaignId;
                response.campaignData = campaignData;
                if (campaignId) {
                    response.campaigns.push(campaignId);
                }
            }
        }
    }

    return {campaigns, response};
}
