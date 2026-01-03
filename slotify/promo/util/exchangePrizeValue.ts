import Exception from "@slotify/shared/lib/Exception";
import {round} from "@slotify/shared/lib/round";

export function calculateSignificantDigits(value: number) {
    const fixedDecimal = 2;

    if (value <= 0 || value !== parseFloat(value.toFixed(fixedDecimal))) {
        throw new Exception("calculateSignificantDigits only works for positive numbers with at most 2 decimals");
    }

    const prizeMagnitude = Math.floor(Math.log10(value));

    const significand = round(value) * Math.pow(10, fixedDecimal);
    let prizeValueSignificandOffset = 0;
    while (significand % Math.pow(10, prizeValueSignificandOffset) === 0) {
        prizeValueSignificandOffset++;
    }
    const prizeOffset = prizeValueSignificandOffset - 1 - fixedDecimal;

    return [prizeMagnitude, prizeOffset];
}

export default function exchangePrizeValue(prizeValue: number, currencyRate: number): number {
    if (prizeValue <= 0 || currencyRate <= 0) {
        throw new Exception("Incorrect values for Prize value currency exchange");
    }

    const [prizeMagnitude, prizeOffset] = calculateSignificantDigits(prizeValue);
    const precision = prizeMagnitude - prizeOffset + 1;

    const exchangedPrize = round(prizeValue * currencyRate);

    const significantExchangedPrize = parseFloat(exchangedPrize.toPrecision(precision));
    const [, significantExchangedPrizeOffset] = calculateSignificantDigits(significantExchangedPrize);

    const multiplier = Math.pow(10, -significantExchangedPrizeOffset);
    const a = Math.round(exchangedPrize * 2 * multiplier) / 2 / multiplier;

    return round(a);
}
