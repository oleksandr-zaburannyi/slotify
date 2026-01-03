import {ICurrencyFeed} from "./currencyFeed";
import fetch from "@slotify/shared/lib/fetch";
import {DateTime} from "../util/luxon";
import logger from "@slotify/shared/lib/logger";
import {default as getLatestCurrencies} from "../route/currencies";

const currency = "arsblue";

export const bluelytics: ICurrencyFeed = async (currencies, date) => {
    const rates: Record<string, number> = {};
    if (currencies.length === 0) {
        return {};
    }
    if (currencies[0] !== currency) {
        logger.warn(`'bluelytics' feed can only support '${currency}' currency`);
        return {};
    }
    if (currencies.length > 2) {
        logger.warn("'bluelytics' feed can only support one currency");
        return {};
    }

    let json;
    try {
        const response = await fetch("https://api.bluelytics.com.ar/v2/historical?day=" + DateTime.fromJSDate(date).toFormat("yyyy-MM-dd"));
        json = await response.json();

        const {currencies: latestCurrencies} = await getLatestCurrencies();
        const usd = latestCurrencies.find((c: any) => c.currency === "usd")?.rate;
        if (!usd) {
            logger.warn("'bluelytics' feed requires to have at least one 'usd' exchange rate");
            return {};
        }
        return {[currency]: json.blue.value_avg * usd};
    } catch (e) {
        logger.warn("Couldn't parse currency feed (bluelytics)", {json, date: DateTime.fromJSDate(date).toFormat("yyyy-MM-dd"), error: e});
    }

    return rates;
};
