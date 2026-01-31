import cache from "@slotify/shared/lib/cache";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import Exception from "@slotify/shared/lib/Exception";
import {getServiceUrl} from "@slotify/shared/lib/urls";

export const baseCurrency = process.env.BASE_CURRENCY!;

export async function getCurrencyRate(currencyFrom: string, currencyTo: string = baseCurrency) {
    const currencies = await getCurrencies();
    const from = currencies.find(item => item.currency === currencyFrom);
    const to = currencies.find(item => item.currency === currencyTo);
    if (!from || !to) throw new Exception("Couldn't find currency conversion ratio", {data: {from, to}});
    return from.rate / to.rate;
}

export const getCurrencies = cache(
    10 * 60,
    async (): Promise<{currency: string; rate: number}[]> => {
        const {currencies} = await fetchAndParse(`${getServiceUrl("adapter")}/api/currencies`);
        return currencies;
    },
    ["currencyRates"],
);
