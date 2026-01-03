import {Currency} from "../db/model/Currency";
import {ISettingsFilter} from "../db/model/Settings";

export const currencyDecimals = async (filters: ISettingsFilter) => {
    const result: Record<string, number> = {};
    const currencies = await Currency.getFixedRates();
    for (const {currency} of currencies) {
        const {decimals} = await Currency.getFixedRate(currency, filters);
        result[currency] = decimals;
    }
    return result;
};
