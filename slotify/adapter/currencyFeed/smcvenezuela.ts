import {ICurrencyFeed} from "./currencyFeed";
import fetch from "@slotify/shared/lib/fetch";
import {DateTime} from "../util/luxon";
import logger from "@slotify/shared/lib/logger";
import {default as getLatestCurrencies} from "../route/currencies";

const currency = "ves2";

function isTodayOrYesterday(date: Date) {
    const inputDate = DateTime.fromJSDate(date).startOf("day");
    const today = DateTime.now().startOf("day");
    const yesterday = today.minus({days: 1});

    return inputDate.hasSame(today, "day") || inputDate.hasSame(yesterday, "day");
}

export const smcvenezuela: ICurrencyFeed = async (currencies, date) => {
    const rates: Record<string, number> = {};
    if (currencies.length === 0) {
        return {};
    }
    if (currencies[0] !== currency) {
        logger.warn(`'smcvenezuela' feed can only support '${currency}' currency`);
        return {};
    }
    if (!isTodayOrYesterday(date)) {
        logger.warn("'smcvenezuela' can only save today's or yesterday's rate");
        return null;
    }
    let json;
    try {
        const {currencies: latestCurrencies} = await getLatestCurrencies();
        const usd = latestCurrencies.find((c: any) => c.currency === "usd")?.rate;
        if (!usd) {
            logger.warn("'smcvenezuela' feed requires to have at least one 'usd' exchange rate");
            return {};
        }
        const response = await fetch("https://smcvenezuela.xyz/dolarsmcbot/binance-api.php");
        json = await response.json();

        return {[currency]: parseFloat(json.VES) * usd};
    } catch (e) {
        logger.warn("Couldn't parse currency feed (smcvenezuela)", {json, date: DateTime.fromJSDate(date).toFormat("yyyy-MM-dd"), error: e});
    }

    return rates;
};
