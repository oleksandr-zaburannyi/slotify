import Exception from "@slotify/shared/lib/Exception";
import {BaseEntity, Column, Entity, PrimaryColumn, ValueTransformer} from "typeorm";
import cache from "@slotify/shared/lib/cache";
import {ISettingsFilter, Settings} from "./Settings";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

const baseCurrencyDecimals = parseInt(process.env.BASE_CURRENCY_DECIMALS || "2", 10);

@Entity()
export class Currency extends BaseEntity {
    @PrimaryColumn() currency!: string;
    @Column({type: "decimal", transformer: toFloat}) fixedRate!: number;
    @Column({nullable: true, type: "varchar"}) symbol?: string | null;
    @Column() decimals!: number;

    static validate(data: Partial<Currency>) {
        if (data.fixedRate === undefined) {
            throw new Exception("fixedRate needs to be specified");
        }

        if (data.decimals == undefined) throw new Exception("decimals  needs to be specified");
        const power = data.fixedRate <= 0 ? 0 : Math.floor(Math.log10(data.fixedRate));
        if (power + data.decimals < baseCurrencyDecimals) {
            throw new Exception(`decimals for specified fixedRate must be bigger then equal to ${baseCurrencyDecimals - power}`);
        }
    }

    static async getFixedRate(currency: string, filters: ISettingsFilter) {
        const {fixedRate: rate, decimals, symbol} = await this.get(currency);
        const maxDecimals = await Settings.getMaxDecimals(filters);
        return {rate, decimals: Math.min(maxDecimals, decimals), symbol: symbol || currency};
    }

    static getFixedRates = cache(5 * 60, () => Currency.find(), ["currency"]);

    private static get = cache(
        5 * 60,
        async (currency: string) => {
            const exchangeRates = await Currency.getFixedRates();
            const exchangeRate = exchangeRates.find(exchangeRate => exchangeRate.currency === currency);
            if (!exchangeRate) throw new Exception(`Couldn't find fixed exchange rate for '${currency}'`, {code: "CURRENCY_NOT_SUPPORTED"});
            return exchangeRate;
        },
        ["currency"],
    );
}
