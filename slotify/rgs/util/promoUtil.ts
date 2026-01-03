import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl, isServiceAvailable} from "@slotify/shared/lib/urls";
import logger from "@slotify/shared/lib/logger";
import {IPlayer} from "../route/authenticate";
import Exception from "@slotify/shared/lib/Exception";

export async function promoPlay(player: Omit<IPlayer, "sessionId">, provider: string | undefined, game: string, roundId: string, step: number, campaigns: any) {
    const promoPlayer = {
        provider,
        game,
        playerId: player.playerId,
        wallet: player.wallet,
        operator: player.operator,
        brand: player.brand,
        nickname: player.nickname,
        nativeId: player.nativeId,
        currency: player.currency,
        jurisdiction: player.jurisdiction,
    };

    logger.info("Sending promo play", {player: promoPlayer, roundId, step, campaigns});
    if (isServiceAvailable("promo")) {
        const body = JSON.stringify({...promoPlayer, roundId, step, campaigns});
        return await fetchAndParse(`${getServiceUrl("promo")}/api/play`, {
            method: "POST",
            body,
            headers: {"Content-Type": "application/json"},
        });
    }
    throw new Exception("Promo service is not available to send promoPlay");
}
