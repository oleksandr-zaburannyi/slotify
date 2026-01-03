import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {getConnection} from "@slotify/shared/lib/dbOptions";

export default async function currencies() {
    const currencies = (await getConnection("replica").createQueryBuilder(CurrencyExchange, "currency").select().distinctOn(["currency"]).orderBy("currency").addOrderBy("date", "DESC").getMany()).map(({currency, rate}) => ({
        currency,
        rate,
    }));
    return {currencies};
}
