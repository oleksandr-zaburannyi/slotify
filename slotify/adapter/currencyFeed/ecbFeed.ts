import {ICurrencyFeed} from "./currencyFeed";
import fetch from "@slotify/shared/lib/fetch";
import * as xml2js from "xml2js";
import {DateTime} from "../util/luxon";
import logger from "@slotify/shared/lib/logger";

export const ecbFeed: ICurrencyFeed = async (currencies, date) => {
    const rates: Record<string, number> = {};
    let repeat = 3;
    do {
        let text;
        try {
            const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml");
            text = await response.text();

            const xml = await xml2js.parseStringPromise(text);
            const root = xml["gesmes:Envelope"]["Cube"][0]["Cube"];

            //ecb feed not available on the weekend, so take the latest available
            const dailyRates = root
                .filter((child: any) => new Date(child["$"].time).getTime() <= date.getTime())
                .sort((a: any, b: any) => new Date(b["$"].time).getTime() - new Date(a["$"].time).getTime())
                .at(0);

            if (dailyRates) {
                for (const currency of currencies) {
                    const dailyRate = dailyRates.Cube.find((rate: any) => rate["$"].currency.toLowerCase() === currency);
                    if (dailyRate) {
                        rates[currency] = parseFloat(dailyRate["$"].rate);
                    }
                }
            }

            return rates;
        } catch (e) {
            logger.warn("Couldn't parse currency feed (ecb)", {repeat, text, date: DateTime.fromJSDate(date).toFormat("yyyy-MM-dd"), error: e});
        }
    } while (--repeat > 0);
    return rates;
};
