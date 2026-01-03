import fetch from "@slotify/shared/lib/fetch";
import logger from "@slotify/shared/lib/logger";
import {ICurrencyFeed} from "./currencyFeed";
import {DateTime} from "../util/luxon";
import wait from "@slotify/shared/lib/wait";

const baseCurrency = process.env.BASE_CURRENCY!;

export const coinLayerFeed: ICurrencyFeed = async (currencies, date, config) => {
    const ratios: Record<string, number> = {};
    for (const currency of currencies) {
        let response;
        const dateString = DateTime.fromJSDate(date).toFormat("yyyy-MM-dd");
        const params = new URLSearchParams({
            access_key: config.secretKey,
            from: baseCurrency.toUpperCase(),
            to: currency.toUpperCase(),
            amount: "1",
            date: dateString,
        }).toString();
        const url = `https://api.coinlayer.com/convert?${params}`;
        let repeat = 3;
        do {
            repeat--;
            try {
                const request = await fetch(url);
                response = await request.json();
                await wait(250); //the free plan allows doing 4-5 requests per second, so we need to wait a bit to avoid rate limiting
            } catch (e) {
                if (repeat === 0) {
                    logger.warn("Couldn't fetch currency feed (coinLayer)", {currency, url, response, date: dateString, error: e});
                    return {};
                }
            }
        } while (!response && repeat > 0);
        const rate = response?.info?.rate;
        if (rate !== undefined) {
            ratios[currency] = rate;
        } else {
            logger.warn("Couldn't parse currency feed (coinLayer)", {url, response, date: dateString});
        }
    }

    return ratios;
};
