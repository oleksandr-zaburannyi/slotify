import {fetchAndParse} from "@slotify/shared/lib/fetch";
import * as crypto from "crypto";
import {getServiceUrl} from "@slotify/shared/lib/urls";

export default async function walletMessage(provider: string, game: string, playerId: string, data: any) {
    const body = JSON.stringify({playerId, data, game, provider});
    const headers = {
        "Content-Type": "application/json",
        "X-Server-Authorization": crypto.createHmac("sha256", process.env.ADAPTER_RGS_KEY!).update(body).digest("hex"),
    };
    const url = `${getServiceUrl("adapter")}/rgs/${process.env.RGS}/message`;
    return await fetchAndParse(url, {method: "POST", body, headers, timeout: 45 * 1000}, 1);
}
