import cache from "@slotify/shared/lib/cache";
import {getCurrencies} from "../util/adapterUtil";

export const currencyExchangeRates = cache(2 * 60, async () => {
    return (await getCurrencies()).reduce((result: Record<string, number>, {currency, rate}) => {
        result[currency] = rate;
        return result;
    }, {});
});
