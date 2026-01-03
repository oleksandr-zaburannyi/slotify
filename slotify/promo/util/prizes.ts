import * as crypto from "crypto";
import {v4} from "uuid";
import {getTool} from "../tools/tools";
import {CampaignPrize} from "../db/model/CampaignPrize";
import {EntityManager} from "typeorm";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Campaign} from "../db/model/Campaign";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {IPrize} from "./ITool";
import logger from "@slotify/shared/lib/logger";
import {getServiceUrl} from "@slotify/shared/lib/urls";

export async function savePrizes(manager: EntityManager, prizes: IPrize[], campaignId: string) {
    const campaignPrizes: CampaignPrize[] = [];
    for (const {type, data, comment, playerId} of prizes) {
        campaignPrizes.push(await manager.save(CampaignPrize, {type, data, campaignId, playerId, comment, paid: false}));
    }
    return campaignPrizes;
}

export async function payPrizes(prizes: CampaignPrize[]) {
    for (const prize of prizes) {
        await getConnection("primary").transaction(async manager => {
            await payPrize(prize, manager);
        });
    }
}

async function payPrize({type, id, playerId, data, campaignId}: CampaignPrize, manager: EntityManager) {
    try {
        switch (type) {
            case "campaign":
                const tool = getTool(data.type);
                const {name, config, providers, games, wallets, operators, brands, playerIds, nativeIds} = data;
                let state;
                if (tool.create) {
                    state = await tool.create({name, config, providers, games, wallets, operators, brands, playerIds, nativeIds});
                }
                await Campaign.createWithState(data, state, manager);
                break;
            case "cash":
                const campaign = (await manager.findOneBy<Campaign>(Campaign, {campaignId}))!;
                await sendTransaction("prize_" + id, playerId, data.amount, data.jackpotAmount, campaignId, campaign.type, campaign.name);
                break;
            case "item":
                break;
        }
        await manager.update(CampaignPrize, {id}, {paid: true});
    } catch (e) {
        logger.warn("Couldn't pay the prize", {error: e, campaignId, playerId, id});
    }
}

async function sendTransaction(rgsTransactionId: string, playerId: string, amount: number, jackpotAmount: number, campaignId: string, campaignType: string, name: string) {
    const body = JSON.stringify({rgsTransactionId, playerId, repeat: 1, type: "deposit", amount, jackpotAmount, campaignId, campaignType, category: "promo", name, roundId: v4(), roundFinished: true});
    const headers = {
        "Content-Type": "application/json",
        "X-Server-Authorization": crypto.createHmac("sha256", process.env.ADAPTER_RGS_KEY!).update(body).digest("hex"),
    };
    const url = `${getServiceUrl("adapter")}/rgs/${process.env.RGS}/transaction`;
    await fetchAndParse(url, {method: "PUT", body, headers}, 0);
}
