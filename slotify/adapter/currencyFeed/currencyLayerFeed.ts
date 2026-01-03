import fetch from "@slotify/shared/lib/fetch";
import logger from "@slotify/shared/lib/logger";
import wait from "@slotify/shared/lib/wait";
import {ICurrencyFeed} from "./currencyFeed";
import {DateTime} from "../util/luxon";

const baseCurrency = process.env.BASE_CURRENCY!;

export const currencyLayerFeed: ICurrencyFeed = async (currencies, date, config) => {
    await wait(100 + Math.random() * 3000); //add random wait to avoid rate limmiting in free plan

    const rates: Record<string, number> = {};
    const url = `http://api.currencylayer.com/historical?access_key=${config?.secretKey}&date=${DateTime.fromJSDate(date).toFormat("yyyy-MM-dd")}&currencies=${currencies.join(",")}`;

    const response = await fetch(url);
    const data = await response.json();
    if (!data?.success) {
        logger.warn("Couldn't parse currency feed (currencyLayer)", {url, data, date: DateTime.fromJSDate(date).toFormat("yyyy-MM-dd")});
        return {};
    }

    data.quotes["USDUSD"] = 1;
    const usd2base = data.quotes["USD" + baseCurrency.toUpperCase()];

    for (const quote in data.quotes) {
        const currency = quote.substring(3).toLowerCase();
        const rate = data.quotes[quote] / usd2base;
        rates[currency] = rate;
    }

    return rates;
};
