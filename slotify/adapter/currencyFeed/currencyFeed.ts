import logger from "@slotify/shared/lib/logger";
import {DateTime} from "../util/luxon";
import {sendAlert} from "@slotify/shared/lib/sendAlert";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {CurrencyFeed} from "../db/model/CurrencyFeed";
import currencies from "../route/currencies";
import cache from "@slotify/shared/lib/cache";
import {CurrencyAlias} from "../db/model/CurrencyAlias";
import {currencyLayerFeed} from "./currencyLayerFeed";
import sum from "@slotify/shared/lib/sum";
import {coinApiFeed} from "./coinApiFeed";
import {coinLayerFeed} from "./coinLayerFeed";
import {ecbFeed} from "./ecbFeed";
import {bluelytics} from "./bluelytics";
import Exception from "@slotify/shared/lib/Exception";
import {smcvenezuela} from "./smcvenezuela";

export type ICurrencyFeed = (currencies: string[], date: Date, config: any) => Promise<Record<string, number> | null>;

const currencyFeeds: Record<string, ICurrencyFeed> = {
    "ecb": ecbFeed,
    "currencyLayer": currencyLayerFeed,
    "coinAPI": coinApiFeed,
    "coinLayer": coinLayerFeed,
    "bluelytics": bluelytics,
    "SMCVenezuela": smcvenezuela,
};

export const getSupportedCurrencies = cache(
    5 * 60,
    async () => {
        return (await currencies()).currencies.map(({currency}) => currency);
    },
    ["currencyAliases, currencyFeeds"],
);

type IRatesPerFeed = Record<string, Record<string, number>>;

export async function fetchCurrencies(daysBack: number = 2) {
    for (let i = daysBack; i > 0; i--) {
        const errors: string[] = [];
        const date = DateTime.utc().startOf("day").minus({days: i});

        const ratesPerFeed = await downloadRatesFromFeeds(date.toJSDate(), errors);
        const averageRates = getAverageRates(ratesPerFeed, errors);
        await saveCurrenciesToDb(averageRates, date.toJSDate(), errors);

        //send error
        if (errors.length > 0) {
            sendAlert(`Problems with downloading currencies on ${date.toFormat("yyyy-MM-dd")}`, `<ul>${errors.map(error => `<li>${error}</li>`).join("")}</ul>`);
        }
    }
}

async function addCurrency(currency: string, date: Date, rate: number) {
    await CurrencyExchange.delete({currency, date});
    await CurrencyExchange.create({currency, date, rate}).save();
    const aliases = await CurrencyAlias.findBy({currency});
    for (const {alias, multiplier} of aliases) {
        await CurrencyExchange.delete({currency: alias, date});
        await CurrencyExchange.create({currency: alias, date, rate: multiplier ? rate / multiplier : 0}).save();
    }
}

async function addRatio(date: Date, alias: string, currency: string, rate: number, multiplier: number) {
    await CurrencyExchange.delete({currency: alias, date});
    await CurrencyExchange.create({currency: alias, date, rate: multiplier ? rate / multiplier : 0}).save();
}

export async function updateLastCurrencyExchangeOfAlias(alias: string, currency: string, multiplier: number) {
    const date = DateTime.utc().startOf("day").minus({days: 1}).toJSDate();
    const exchangeRate = await CurrencyExchange.findOne({where: {currency}, order: {date: "DESC"}});
    if (!exchangeRate) throw new Exception(`Couldn't find exchange rate for '${currency}'`);
    await addRatio(date, alias, currency, exchangeRate.rate, multiplier);
}

function percentageDifferenceAboveTolerance(value1: number, value2: number, tolerancePercentage: number) {
    return Math.max(value1, value2) / Math.min(value1, value2) > 1 + tolerancePercentage;
}

function getAverageRates(rates: IRatesPerFeed, errors: string[]) {
    const TOLERANCE_DIFFERENCE_BETWEEN_FEEDS = 0.05;
    let allCurrencies: string[] = [];
    for (const feed of Object.keys(rates)) {
        allCurrencies = [...allCurrencies, ...Object.keys(rates[feed])];
    }

    const baseCurrency = process.env.BASE_CURRENCY!;
    const averageRates: Record<string, number> = {[baseCurrency]: 1};
    for (const currency of allCurrencies) {
        const currencyRates: {feed: string; rate: number}[] = [];
        for (const feed of Object.keys(rates)) {
            const rate = rates[feed][currency];
            if (rate) {
                currencyRates.push({rate, feed});
            }
        }
        currencyRates.sort((a, b) => a.rate - b.rate);
        if (currencyRates.length > 0) {
            const minRate = currencyRates.at(0)!;
            const maxRate = currencyRates.at(-1)!;
            if (percentageDifferenceAboveTolerance(minRate.rate, maxRate.rate, TOLERANCE_DIFFERENCE_BETWEEN_FEEDS)) {
                errors.push(
                    `Rate ignorred due to difference in <code>${currency}</code> rates between '${minRate.feed}' (<code>${minRate.rate}</code>) and '${maxRate.feed}' (<code>${maxRate.rate}</code>) is bigger than <code>${TOLERANCE_DIFFERENCE_BETWEEN_FEEDS * 100}%</code>`,
                );
            } else {
                averageRates[currency] = sum(currencyRates.map(({rate}) => rate)) / currencyRates.length;
            }
        }
    }
    return averageRates;
}

async function downloadRatesFromFeeds(date: Date, errors: string[]) {
    const feeds = await CurrencyFeed.findBy({enabled: true});

    const ratesPerFeed: IRatesPerFeed = {};
    for (const {feed, currencies, config, enabled} of feeds) {
        if (!currencyFeeds[feed]) {
            logger.warn(`Couldn't find currency feed '${feed}'`);
            continue;
        }
        if (!enabled) {
            continue;
        }

        logger.info(`Downloading currencies from '${feed}' feed on ${DateTime.fromJSDate(date).toFormat("yyyy-MM-dd")}`);

        try {
            const result = await currencyFeeds[feed](currencies, date, config);
            if (!result) continue;
            ratesPerFeed[feed] = result;

            const missingCurrencies = currencies.filter(currency => !ratesPerFeed[feed][currency]);
            if (missingCurrencies.length > 0) {
                errors.push(
                    `Missing currencies from '${feed}' feed: ${missingCurrencies
                        .sort()
                        .map(currency => `<code>${currency}</code>`)
                        .join(", ")}.`,
                );
            }
        } catch (e) {
            logger.warn(`Error downloading '${feed}' feed`, {error: e});
            errors.push(`Error downloading '${feed}' feed`);
        }
    }
    return ratesPerFeed;
}

async function saveCurrenciesToDb(averateRates: Record<string, number>, date: Date, errors: string[]) {
    const {currencies: latestCurrencies} = await currencies();

    for (const [currency, averageRate] of Object.entries(averateRates)) {
        const lastRate = latestCurrencies.find(item => item.currency === currency)?.rate;
        const TOLERANCE_DIFFERENCE_FROM_PREVIOUS_RATE = 1.0;
        if (lastRate && percentageDifferenceAboveTolerance(lastRate, averageRate, TOLERANCE_DIFFERENCE_FROM_PREVIOUS_RATE)) {
            errors.push(`Rate ignorred due to unusually large change on currency <code>${currency}</code> from <code>${lastRate}</code> to <code>${averageRate}</code>`);
        } else {
            await addCurrency(currency, date, averageRate);
        }
    }
}
