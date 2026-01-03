import cache from "@slotify/shared/lib/cache";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Currency} from "../db/model/Currency";

export const currencySymbols = cache(
    2 * 60,
    async () => {
        return (await getConnection("replica").manager.find(Currency, {select: ["currency", "symbol"]})).reduce((result: Record<string, string>, {currency, symbol}) => {
            result[currency] = symbol || currency;
            return result;
        }, {});
    },
    ["currency"],
);
