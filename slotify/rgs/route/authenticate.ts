import auth from "@slotify/shared/lib/middleware/jwtAuth";
import * as crypto from "crypto";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {Currency} from "../db/model/Currency";
import {Round} from "../db/model/Round";
import {cancelRound} from "./play";
import complete from "./complete";
import logger from "@slotify/shared/lib/logger";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {initPlayerSeeds} from "../util/provablyFairUtil";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";

export type IPlayer = {playerId: string; brand?: string; operator: string; wallet: string; nativeId: string; currency: string; jurisdiction?: string; sessionId: string; nickname?: string};
export default async function authenticate(
    wallet: string,
    operator: string,
    key: string,
    provider: string,
    game: string,
    channel: string | undefined,
    ip: string,
    ipBlockedCountryHeader?: string,
): Promise<{token: string; balance: number; currency: string; currencyDecimals: number; currencySymbol: string; sessionData?: any; jurisdiction?: string; playerId: string; nickname?: string; popups?: IExceptionPopup[]}> {
    const body = JSON.stringify({wallet, operator, key, provider, game, ip, channel});
    const headers = clearEmpty({
        "Content-Type": "application/json",
        "X-Server-Authorization": crypto.createHmac("sha256", process.env.ADAPTER_RGS_KEY!).update(body).digest("hex"),
        "ip-blocked-country": ipBlockedCountryHeader,
    });
    const url = `${getServiceUrl("adapter")}/rgs/${process.env.RGS}/authenticate`;
    const response = await fetchAndParse(url, {method: "POST", body, headers, timeout: 30 * 1000});
    const {currency, nativeId, playerId, brand, jurisdiction, sessionData, sessionId, nickname, popups} = response;
    const player: IPlayer = {playerId, brand, operator, wallet, nativeId, currency, jurisdiction, sessionId, nickname};
    const token = auth.sign(player, "player");
    const settingsFilter: ISettingsFilter = {wallet, operator, brand, provider, game, currency, jurisdiction};

    if (!(await Settings.isGameEnebled(settingsFilter))) throw new Exception("Game not enabled", {code: "GAME_NOT_AVAILABLE"});

    const balance = await retryPendingTransactions(settingsFilter, response.balance, player, provider, game, channel, ip);

    await initPlayerSeeds(settingsFilter, playerId);

    const {symbol: currencySymbol, decimals: currencyDecimals} = await Currency.getFixedRate(currency, settingsFilter);
    const currencyOrSymbol = (await Settings.useCurrencySymbol(settingsFilter)) ? currency : currencySymbol;
    return {token, balance, currency: currencyOrSymbol, currencyDecimals, currencySymbol, sessionData, jurisdiction, playerId, nickname, popups};
}

async function retryPendingTransactions(settingsFilter: ISettingsFilter, balance: number, player: IPlayer, provider: string, game: string, channel: string | undefined, ip: string) {
    const retryExpired = await Settings.getRetryExpired(settingsFilter);
    for (const round of await Round.getStartedFromUser(["unpaid"], player.playerId, provider, game, retryExpired)) {
        try {
            const res = await complete(player, round.roundId, true, channel, ip, true, null);
            if (res?.balance != null) balance = res.balance;
        } catch (error) {
            if (!(await Settings.allowParallelRounds(settingsFilter))) {
                throw new Exception("Couldn't complete unfinished round during authentication", {data: {round, error}});
            } else {
                logger.warn("Couldn't complete unfinished round during authentication", {round, error});
            }
        }
    }
    for (const round of await Round.getStartedFromUser(["failed"], player.playerId, provider, game, retryExpired)) {
        try {
            const res = await cancelRound(settingsFilter, round.roundId, false, null);
            if (res?.balance != null) balance = res.balance;
        } catch (error) {
            logger.warn("Couldn't cancel failed round during authentication", {round, error});
        }
    }
    return balance;
}
