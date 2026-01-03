import cache from "@slotify/shared/lib/cache";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import Exception from "@slotify/shared/lib/Exception";
import {getServiceUrl} from "@slotify/shared/lib/urls";

export const baseCurrency = process.env.BASE_CURRENCY!;

export async function getCurrencyRate(currency: string) {
    const currencies = await getCurrencies();
    const item = currencies.find(item => item.currency === currency);
    if (!item) throw new Exception("Couldn't find currency conversion ratio");
    return item.rate;
}

export const getCurrencies = cache(
    10 * 60,
    async (): Promise<{currency: string; rate: number}[]> => {
        const {currencies} = await fetchAndParse(`${getServiceUrl("adapter")}/api/currencies`);
        return currencies;
    },
    ["currencyRates"],
);
