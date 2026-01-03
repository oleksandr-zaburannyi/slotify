import {Campaign, CampaingType, Connector} from "../Connector";
import {FreeBetsUi} from "./FreeBetsUi";
import {IPromoToolUi} from "./IPromoToolUi";
import {PrizeDropUi} from "./PrizeDropUi";
import {TournamentUi} from "./TournamentUi";

const expirationTimeouts: NodeJS.Timeout[] = [];
let validCampaignTypes: string[] = [];
let isIdle: boolean = true;

const promoToolUis: Record<CampaingType, IPromoToolUi> = {
    "freeBets": new FreeBetsUi(),
    "prizeDrop": new PrizeDropUi(),
    "tournament": new TournamentUi(),
};

async function promoUi(connector: Connector) {
    connector.emitter.on("wager", async data => {
        isIdle = false;
        await updateCampaigns(connector, async (tool, campaign) => await tool.onWager(connector, campaign, data));
    });

    connector.emitter.on("stopped", async data => {
        isIdle = true;
        await updateCampaigns(connector, async (tool, campaign) => await tool.onStopped(connector, campaign, data));
    });

    connector.emitter.on("betChanged", async data => {
        await updateCampaigns(connector, async (tool, campaign) => await tool.onBetChanged(connector, campaign, data));
    });

    const campaigns: Campaign[] = await connector.getCampaigns();

    validCampaignTypes = Object.keys(promoToolUis).filter(campaignType => campaigns.some(campaign => campaign.type === campaignType));

    return await updateCampaigns(connector, async (tool, campaign) => await tool.init(connector, campaign));
}

async function updateCampaigns(connector: Connector, applier: (tool: IPromoToolUi, campaign: Campaign) => Promise<{shouldIgnore: boolean; shouldRefresh: boolean}>) {
    if (validCampaignTypes.length > 0) {
        let campaigns = await connector.getCampaigns();

        for (const campaignType in promoToolUis) {
            const activeCampaignId = promoToolUis[campaignType as CampaingType].getActiveCampaignId();
            if (!activeCampaignId) continue;

            const hasActiveCampaign = campaigns.some(campaign => campaign.campaignId === activeCampaignId);
            if (!hasActiveCampaign) connector.ui().removePromoHeader(campaignType);
        }

        for (const campaignType of [...validCampaignTypes]) {
            let refresh: boolean;
            do {
                refresh = false;

                const campaign = campaigns.find(campaign => campaign.type === campaignType);
                if (campaign) {
                    const {shouldIgnore, shouldRefresh} = await applier(promoToolUis[campaign.type], campaign);
                    if (shouldIgnore) {
                        validCampaignTypes = validCampaignTypes.filter(type => type !== campaign.type);
                    }
                    if (shouldRefresh) {
                        refresh = true;
                        campaigns = await connector.getCampaigns();
                    }
                } else {
                    validCampaignTypes = validCampaignTypes.filter(type => type !== campaignType);
                }
            } while (refresh);
        }

        checkExpiredCampaigns(connector, campaigns);
    }
}

function checkExpiredCampaigns(connector: Connector, campaigns: Campaign[]) {
    while (expirationTimeouts.length) clearTimeout(expirationTimeouts.pop());

    for (const {status, end, campaignId} of campaigns) {
        if (["active", "started"].includes(status) && end) {
            const delay = new Date(end).getTime() - Date.now();
            const maxDelay = 2147483647; // 2**31-1 is the highest possible delay in setTimeout
            if (delay > 0 && delay < maxDelay) {
                const timeout = setTimeout(async () => {
                    if (!isIdle) {
                        return; // ignore the check if gameplay presentation is in progress
                    }
                    await updateCampaigns(connector, async (tool, campaign) => {
                        if (campaign.campaignId === campaignId) {
                            return await tool.onExpired(connector, campaign);
                        }
                        return {shouldIgnore: false, shouldRefresh: false};
                    });
                }, delay);
                expirationTimeouts.push(timeout);
            }
        }
    }
}

export function getPromoToolUis() {
    return promoToolUis;
}

export default promoUi;
