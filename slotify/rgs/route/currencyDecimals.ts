import cache from "@slotify/shared/lib/cache";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Currency} from "../db/model/Currency";

export const currencyDecimals = cache(
    2 * 60,
    async () => {
        return (await getConnection("replica").manager.find(Currency, {select: ["currency", "decimals"]})).reduce((result: Record<string, number>, {currency, decimals}) => {
            result[currency] = decimals;
            return result;
        }, {});
    },
    ["currency"],
);
