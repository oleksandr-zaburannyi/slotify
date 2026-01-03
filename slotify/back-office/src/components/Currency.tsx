import {FC, useEffect, useState} from "react";
import {useAppState} from "../lib/AppProvider";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {gql} from "graphql-request";
import {formatCurrency} from "../lib/helpers";

let decimalsPerCurrency: Record<string, number>;
let promise;

const fetchCurrencies = (fetcher: any, setDecimalsPerCurrency: any) => {
    promise ||= fetcher([
        gql`
            query {
                fixedCurrencyRates(limit: 10000) {
                    items {
                        currency
                        decimals
                    }
                }
            }
        `,
        {},
    ]);
    if (decimalsPerCurrency) {
        setDecimalsPerCurrency(decimalsPerCurrency);
        return;
    }
    promise.then((data: any) => {
        const obj: Record<string, number> = {};
        for (const {currency, decimals} of data.fixedCurrencyRates.items) {
            obj[currency] = decimals;
        }
        decimalsPerCurrency = obj;
        setDecimalsPerCurrency(obj);
    });
};

const Currency: FC<{
    currency: string;
    amount: number;
    onlyAmount?: boolean;
    showMaxDecimals?: boolean;
}> = ({currency, amount, onlyAmount = true, showMaxDecimals = false}) => {
    const [state] = useAppState();
    const [decimalsPerCurrency, setDecimalsPerCurrency] = useState<Record<string, number>>({});
    const fetcher = useGraphQlFetcher();

    useEffect(() => {
        if (state.services.includes("rgs") && state.account.permissions.includes("fixedCurrencyRates")) {
            fetchCurrencies(fetcher, setDecimalsPerCurrency);
        }
    }, []);

    const formattedValue = formatCurrency(decimalsPerCurrency[currency], showMaxDecimals ? 20 : decimalsPerCurrency[currency], amount);

    return (
        <>
            {formattedValue}
            {!onlyAmount && formattedValue != "" && " " + currency}
        </>
    );
};
export default Currency;
