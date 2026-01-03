import {Currency} from "../db/model/Currency";
import {round} from "@slotify/shared/lib/round";
import Exception from "@slotify/shared/lib/Exception";
import {getBets, isBetAvailable} from "../util/betUtil";
import {Settings} from "../db/model/Settings";

export default async function convertBet(amount: number, currencyFrom: string, currencyTo: string, provider: string, game: string, wallet: string, operator: string, brand: string, jurisdiction: string) {
    const settingsFilter = {provider, game, currencyTo, wallet, operator, brand, jurisdiction};
    const variant = (await Settings.getValues(settingsFilter)).gameVariant;
    const currencyRateFrom = await Currency.getFixedRate(currencyFrom, settingsFilter);
    const currencyRateTo = await Currency.getFixedRate(currencyTo, settingsFilter);
    const converted = round((amount / currencyRateFrom.rate) * currencyRateTo.rate, currencyRateTo.decimals);
    const bets = await getBets(provider, game, variant, currencyTo, wallet, operator, brand, jurisdiction, {});

    if (!bets["main"] || !isBetAvailable(bets["main"].available, currencyRateTo.decimals, converted)) {
        throw new Exception("Bet not supported", {data: {amount, currency: currencyTo, provider, game, wallet, operator, brand, jurisdiction}});
    }

    return converted;
}
