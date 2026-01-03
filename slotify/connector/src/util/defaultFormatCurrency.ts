const defaultFormatCurrency = (value: number, currency?: string, decimals?: number, language?: string): string => {
    try {
        return value.toLocaleString(language?.replace("_", "-"), {style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: 20});
    } catch {
        return value.toFixed(decimals) + " " + currency;
    }
};

export default defaultFormatCurrency;
