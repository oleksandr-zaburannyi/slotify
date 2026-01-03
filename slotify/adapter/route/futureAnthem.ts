import logger from "@slotify/shared/lib/logger";
import fetch from "@slotify/shared/lib/fetch";
import {ITransaction} from "../walletAdapter/IWalletAdapter";
import {Player} from "../db/model/Player";
import Exception from "@slotify/shared/lib/Exception";

const apiUrl = process.env.FUTURE_ANTHEM_API_URL;
const apiKey = process.env.FUTURE_ANTHEM_API_KEY;
const eventPrefix = process.env.FUTURE_ANTHEM_EVENT_PREFIX;

let clusterId = "";

async function getClusterId(): Promise<string> {
    if (clusterId !== "") return clusterId;

    const headers = {"x-api-key": apiKey!};

    const clusterIdResponse = await fetch(`${apiUrl}/clusters`, {
        method: "GET",
        headers,
    });
    if (!clusterIdResponse.ok) {
        throw new Exception(`Fetch error: ${clusterIdResponse.status} ${clusterIdResponse.statusText}`);
    }
    const json = await clusterIdResponse.json();
    const data = json.data;
    if (data.length < 1) {
        throw new Exception(`FutureAnthem clusterId retrieval error: empty list of data`);
    }

    clusterId = data[0].cluster_id;
    if (clusterId === "") {
        throw new Exception("FutureAnthem clusterId retrieval error, cluster_id is empty");
    }

    return clusterId;
}

function sendToFutureAnthem(event: string, data: any, repeat: number = 0) {
    if (!apiUrl) return;

    const headers = {
        "x-api-key": apiKey!,
        "Content-Type": "application/json",
    };

    const body = JSON.stringify({
        value: {
            type: "STRING",
            data: JSON.stringify(data),
        },
    });

    getClusterId()
        .then(clusterId => {
            fetch(`${apiUrl}/clusters/${clusterId}/topics/${eventPrefix}-casino-${event}/records`, {
                method: "POST",
                headers,
                body,
            })
                .then(response =>
                    logger.info(`FutureAnthem response code ${response.status}`, {
                        status: response.status,
                        res: response.text(),
                    }),
                )
                .catch(error => {
                    logger.info("FutureAnthem error", {error});
                    if (repeat > 0) {
                        sendToFutureAnthem(event, data, repeat - 1);
                    }
                });
        })
        .catch(error => {
            logger.info("FutureAnthem error", {error});
        });
}

export const futureAnthem = {
    authenticate: (player: Player, playerExclusion: {excluded: boolean; reason?: string}) => {
        sendToFutureAnthem("authenticate", {
            createdAt: player.createdAt.getTime(),
            playerId: player.id,
            currency: player.currency,
            operator: player.operator,
            wallet: player.wallet,
            brand: player.brand,
            gender: player.gender,
            country: player.country,
            jurisdiction: player.jurisdiction,
            group: player.group ? player.group : null,
            test: playerExclusion.excluded,
            exclusionReason: playerExclusion.reason,
        });
    },
    transaction: (transaction: ITransaction & {createdAt: Date; id: string}, balance: number) => {
        sendToFutureAnthem("transaction", {
            createdAt: transaction.createdAt.getTime(),
            transactionId: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            jackpotAmount: transaction.jackpotAmount,
            game: transaction.game,
            provider: transaction.provider,
            roundId: transaction.roundId,
            variant: transaction.variant,
            category: transaction.category,
            name: transaction.name,
            roundFinished: transaction.roundFinished,
            campaignType: transaction.campaignType,
            campaignId: transaction.campaignId,
            channel: transaction.channel,
            playerId: transaction.playerId,
            balance,
        });
    },
    cancel: (transactionId: string) => {
        sendToFutureAnthem("cancel", {transactionId});
    },
};
