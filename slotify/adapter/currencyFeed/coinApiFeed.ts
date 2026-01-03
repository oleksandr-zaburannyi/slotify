import fetch from "@slotify/shared/lib/fetch";
import logger from "@slotify/shared/lib/logger";
import wait from "@slotify/shared/lib/wait";
import {ICurrencyFeed} from "./currencyFeed";
import {DateTime} from "../util/luxon";

export const coinApiFeed: ICurrencyFeed = async (currencies, date, config) => {
    const baseCurrency = process.env.BASE_CURRENCY!;
    const ratios: Record<string, number> = {};
    for (const currency of currencies) {
        let response;
        const url = `https://rest.coinapi.io/v1/exchangerate/${baseCurrency.toUpperCase()}/${currency.toUpperCase()}/history?period_id=1DAY&time_start=${DateTime.fromJSDate(date).toFormat("yyyy-MM-dd")}T00:00:00&time_end=${DateTime.fromJSDate(date).toFormat("yyyy-MM-dd")}T23:59:59`;
        let repeat = 3;
        let rateLimitRetries = 3;

        do {
            try {
                const request = await fetch(url, {headers: {"X-CoinAPI-Key": config.secretKey}});

                // Too Many Requests
                if (request.status === 429 && rateLimitRetries > 0) {
                    rateLimitRetries--;
                    const retryAfter = request.headers.get("Retry-After");
                    if (retryAfter) {
                        const waitTime = parseInt(retryAfter, 10) * 1000;
                        logger.info(`Rate limit reached. Waiting for ${waitTime}ms before retrying. Retries left: ${rateLimitRetries}`);
                        await wait(waitTime);
                        continue;
                    }
                }

                response = await request.json();
            } catch (e) {
                repeat--;
                if (repeat === 0) {
                    logger.warn("Couldn't fetch currency feed (coinAPI)", {currency, url, response, date: DateTime.fromJSDate(date).toFormat("yyyy-MM-dd"), error: e});
                    return {};
                }
            }
        } while (!response && (repeat > 0 || rateLimitRetries > 0));

        const rate = response[0]?.rate_close;
        if (rate !== undefined) {
            ratios[currency] = rate;
        } else {
            logger.warn("Couldn't parse currency feed (coinAPI)", {url, response, date: DateTime.fromJSDate(date).toFormat("yyyy-MM-dd")});
        }
    }

    return ratios;
};
