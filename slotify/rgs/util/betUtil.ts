import {ISettingsFilter, Settings} from "../db/model/Settings";
import {round} from "@slotify/shared/lib/round";
import {Currency} from "../db/model/Currency";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import cache from "@slotify/shared/lib/cache";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {ISessionData} from "./sessionUtil";
import {gamesService} from "./gamesUtil";
import countDecimals from "@slotify/shared/lib/countDecimals";
import {Room} from "../db/model/Room";
import {floor} from "@slotify/shared/lib/floor";
import {getServiceUrl} from "@slotify/shared/lib/urls";

//these values are in the player's currency
export type IBetLimits = {
    minBet: number;
    maxBet: number;
    defaultBet?: number;
    maxBonusBet?: number;
    maxExposure: number;
    currencyRate: number;
    exchangeRate?: number;
    currencyDecimals: number;
    currencyUnit: number;
};

//these values are in the base currency
export type IBetConfig = {
    minBet: number;
    maxBet: number;
    maxExposure: number;
    maxBonusBet?: number;
    defaultBet?: number;
};

export type IBet = {available: IAvailableBets; default: number; coin: number};
export type IBetsRange = {min: number; max: number; step: number};
export type IAvailableBets = number[] | IBetsRange;
type IGameBet = IBet & {maxWin: number; validate?: boolean};
type BulkAvailableBets = {[game: string]: {[currency: string]: number[]}};

const maxBetsInFreeBets = 200;

export async function getBetsBulk(provider: string | undefined, games: string[], currencies: string[], wallet: string, operator: string | undefined, brand: string | undefined, jurisdiction: string): Promise<BulkAvailableBets> {
    currencies ||= (await Currency.getFixedRates()).map(({currency}) => currency);

    const bulkAvailableBets: BulkAvailableBets = {};
    for (const game of games) {
        for (const currency of currencies) {
            const settingsFilter = {provider, game, currency, wallet, operator, brand, jurisdiction};
            const {decimals, rate} = await Currency.getFixedRate(currency, settingsFilter);
            const variant = (await Settings.getValues(settingsFilter)).gameVariant;
            const result = await getBets(provider, game, variant, currency, wallet, operator, brand, jurisdiction, {});
            const available = result?.main?.available;
            if (available) bulkAvailableBets[game] = {...bulkAvailableBets[game], ...{[currency]: generateAvailable(available, decimals, rate, maxBetsInFreeBets)}};
        }
    }
    return bulkAvailableBets;
}

export async function getAvailableBets(provider: string, game: string, currency: string, wallet: string, operator: string, brand?: string, jurisdiction?: string, roomId?: string) {
    const settingsFilter = {provider, game, currency, wallet, operator, brand, jurisdiction};
    const variant = (await Settings.getValues(settingsFilter)).gameVariant;
    const result = await getBets(provider, game, variant, currency, wallet, operator, brand, jurisdiction, {}, roomId);
    const {decimals, rate} = await Currency.getFixedRate(currency, settingsFilter);
    for (const action in result) {
        result[action].available = generateAvailable(result[action].available, decimals, rate, maxBetsInFreeBets);
    }
    return result;
}

export function getBetStep(step: number, rate: number, decimals: number) {
    return round(Math.max(step * rate, getCurrencyUnit(decimals)), decimals);
}

export function getCurrencyUnit(decimals: number) {
    return 1 / 10 ** decimals;
}

export function isBetAvailable(available: IAvailableBets, decimals: number, bet: number) {
    if (Array.isArray(available)) {
        return available.includes(bet);
    }

    if (countDecimals(bet) > decimals || bet > available.max || bet < available.min) {
        return false;
    }

    const offset = round(bet - available.min, decimals);
    return Math.round(offset * 10 ** decimals) % Math.round(available.step * 10 ** decimals) === 0;
}

export function generateAvailable(available: IAvailableBets, decimals: number, rate: number, maxBets: number = Number.MAX_SAFE_INTEGER): number[] {
    if (Array.isArray(available)) {
        return available;
    } else {
        const numbers: number[] = [];
        let bet = available.min;
        let i = 0;
        while (bet <= available.max && ++i <= maxBets) {
            numbers.push(bet);
            bet = round(bet + available.step, decimals);
        }
        return numbers;
    }
}

export const getGameBets = cache(2 * 60, async (provider: string | undefined, game: string, variant: string | undefined): Promise<Record<string, IGameBet>> => {
    const {bets} = await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/bets?variant=${variant || ""}`);
    return bets;
});

async function getCurrencyFixedRate(currency: string, settingsFilter: ISettingsFilter, sessionData: ISessionData): Promise<{rate: number; decimals: number}> {
    const sessionCurrencyRate = sessionData.currencyRate;
    const {rate, decimals} = await Currency.getFixedRate(currency, settingsFilter);

    return {rate: sessionCurrencyRate || rate, decimals};
}

export async function getCurrencyExchangeRate(currency: string): Promise<number> {
    const currencies = await getAdapterCurrencies();
    return currencies[currency];
}

const getAdapterCurrencies = cache(
    10 * 60,
    async () => {
        const {currencies} = await fetchAndParse(`${getServiceUrl("adapter")}/api/currencies`);
        const adapterCurrencies: {[currency: string]: number} = {};
        currencies.forEach(({currency, rate}: {currency: string; rate: number}) => (adapterCurrencies[currency] = rate));
        return adapterCurrencies;
    },
    ["currencyRates"],
);

export async function getBaseCurrencyBetConfig(settingsFilter: ISettingsFilter, roomId?: string): Promise<IBetConfig> {
    const defaultBetConfig: IBetConfig = {minBet: 0.01, maxBet: 10000, maxExposure: 10000000};
    const settingBetConfig: Partial<IBetConfig> = await Settings.getBetConfig(settingsFilter);

    const betConfig = Object.assign(defaultBetConfig, clearEmpty(settingBetConfig));

    const roomConfig = roomId ? await Room.findOneByOrFail({roomId}) : ({} as Room);

    const minBet = Math.max(betConfig.minBet, roomConfig.minBet || 0);
    const maxBet = Math.min(betConfig.maxBet, roomConfig.maxBet || Infinity);

    return {
        minBet,
        maxBet,
        defaultBet: betConfig.defaultBet,
        maxBonusBet: betConfig.maxBonusBet,
        maxExposure: betConfig.maxExposure,
    };
}

export function getMinBet(baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number): number {
    return sessionBetConfig.minBet == null ? round(baseCurrencyBetConfig.minBet * rate, decimals) : round(sessionBetConfig.minBet, decimals);
}

export function getMaxBet(baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number): number {
    return sessionBetConfig.maxBet == null ? round(baseCurrencyBetConfig.maxBet * rate, decimals) : round(sessionBetConfig.maxBet, decimals);
}

export function getDefaultBet(baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number): number | undefined {
    if (sessionBetConfig.defaultBet != null) {
        return round(sessionBetConfig.defaultBet, decimals);
    }

    return baseCurrencyBetConfig.defaultBet != null ? round(baseCurrencyBetConfig.defaultBet * rate, decimals) : undefined;
}

export function getMaxBonusBet(baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number): number | undefined {
    if (baseCurrencyBetConfig.maxBonusBet == null) {
        return sessionBetConfig.maxBonusBet == null ? undefined : round(sessionBetConfig.maxBonusBet, decimals);
    }

    return sessionBetConfig.maxBonusBet == null ? round(baseCurrencyBetConfig.maxBonusBet * rate, decimals) : round(sessionBetConfig.maxBonusBet, decimals);
}

export function getMaxExposure(baseCurrencyBetConfig: IBetConfig, sessionBetConfig: Partial<IBetConfig>, rate: number, decimals: number): number {
    return sessionBetConfig.maxExposure == null ? round(baseCurrencyBetConfig.maxExposure * rate, decimals) : round(sessionBetConfig.maxExposure, decimals);
}

export async function getBetLimits(currency: string, settingsFilter: ISettingsFilter, sessionData: ISessionData, roomId?: string): Promise<IBetLimits> {
    const baseCurrencyBetConfig = await getBaseCurrencyBetConfig(settingsFilter, roomId);

    const {rate, decimals} = await getCurrencyFixedRate(currency, settingsFilter, sessionData);

    const sessionBetConfig: Partial<IBetConfig> = sessionData.betConfig || {}; // betConfig in session is in player's currency

    const defaultBet = getDefaultBet(baseCurrencyBetConfig, sessionBetConfig, rate, decimals); // default bet is always calculated via fixed rate

    const exchangeRate = await getCurrencyExchangeRate(currency);

    const actualRate = exchangeRate && (await Settings.useExchangeRateBetLimits(settingsFilter)) ? exchangeRate : rate;

    const minBet = getMinBet(baseCurrencyBetConfig, sessionBetConfig, rate, decimals);
    const maxBet = getMaxBet(baseCurrencyBetConfig, sessionBetConfig, actualRate, decimals);
    const maxBonusBet = getMaxBonusBet(baseCurrencyBetConfig, sessionBetConfig, actualRate, decimals);
    const maxExposure = getMaxExposure(baseCurrencyBetConfig, sessionBetConfig, actualRate, decimals);

    return {
        minBet,
        maxBet,
        defaultBet,
        maxBonusBet,
        maxExposure,
        currencyRate: rate,
        currencyDecimals: decimals,
        currencyUnit: getCurrencyUnit(decimals),
        exchangeRate,
    };
}

export async function getBets(
    provider: string | undefined,
    game: string,
    variant: string | undefined,
    currency: string,
    wallet: string,
    operator: string | undefined,
    brand: string | undefined,
    jurisdiction: string | undefined,
    sessionData: ISessionData,
    roomId?: string,
): Promise<Record<string, IBet>> {
    const settingsFilter = {wallet, operator, brand, jurisdiction, provider, game, currency};
    const customBets = await Settings.getCustomBets(settingsFilter);
    const bets = await getGameBets(provider, game, variant);

    const betLimits = await getBetLimits(currency, settingsFilter, sessionData, roomId);

    const gameBets: Record<string, IBet> = {};
    for (const action in bets) {
        const gameAction: IGameBet = bets[action];
        const isBonusBet = !(await Settings.getMainBets(settingsFilter)).includes(action);
        const available: IAvailableBets = (customBets && customBets[action]) || gameAction.available;

        if (Array.isArray(gameAction.available)) {
            gameBets[action] = getArrayActionBets({...gameAction, available}, isBonusBet, betLimits);
        } else {
            gameBets[action] = getRangeActionBets({...gameAction, available}, isBonusBet, betLimits);
        }
    }

    if (await Settings.syncLeftmostBets(settingsFilter)) {
        syncLeftmostBets(gameBets, betLimits.currencyDecimals);
    }

    return gameBets;
}

function syncLeftmostBets(gameBets: Record<string, IBet>, currencyDecimals: number) {
    for (const action in gameBets) {
        const actionAvailable = gameBets[action].available;
        const mainAvailable = gameBets["main"].available;
        const coinRatio = gameBets[action].coin / gameBets["main"].coin;
        if (Array.isArray(actionAvailable) && Array.isArray(mainAvailable)) {
            while (actionAvailable.length > 0 && actionAvailable[0] !== round(mainAvailable[0] * coinRatio, currencyDecimals)) {
                actionAvailable.shift();
            }
        }
    }
}

export function getArrayActionBets(gameAction: IGameBet, isBonusBet: boolean, betLimits: IBetLimits) {
    const {minBet, maxBet, maxExposure, maxBonusBet, defaultBet, currencyRate, currencyDecimals} = betLimits;

    const availableArray = (gameAction.available as number[])
        .map(bet => round(bet * currencyRate, currencyDecimals))
        .filter(bet => bet >= minBet)
        .filter(bet => minBet === 0 || bet > 0)
        .filter(bet => bet <= (isBonusBet && maxBonusBet != null ? maxBonusBet : maxBet))
        .filter(bet => round(bet * gameAction.maxWin, currencyDecimals) <= maxExposure)
        .sort((a, b) => a - b);

    const gameDefaultBet = defaultBet || round(gameAction.default * currencyRate, currencyDecimals);
    let defaultBetCandidate = availableArray[0];
    for (const bet of availableArray) {
        if (bet <= gameDefaultBet) {
            defaultBetCandidate = bet;
        }
    }

    return {available: availableArray, default: defaultBetCandidate, coin: gameAction.coin};
}

export function getDefaultBetFromRange({min, max, step}: IBetsRange, decimals: number, exactConvertedDefaultBet: number) {
    const stepIndex = floor((exactConvertedDefaultBet - min) / step, 0);
    const defaultBetCandidate = round(min + stepIndex * step, decimals);
    return Math.min(defaultBetCandidate, max);
}

export function getRangeActionBets(gameAction: IGameBet, isBonusBet: boolean, betLimits: IBetLimits) {
    const {maxBet, minBet, maxExposure, maxBonusBet, defaultBet, currencyRate, currencyDecimals} = betLimits;

    const betsRange = gameAction.available as IBetsRange;

    const min = Math.max(betsRange.min * currencyRate, minBet);

    const actualMaxBet = isBonusBet && maxBonusBet ? maxBonusBet : maxBet;
    const max = Math.min(betsRange.max * currencyRate, actualMaxBet, maxExposure / gameAction.maxWin);

    const step = getBetStep(betsRange.step, currencyRate, currencyDecimals);

    const convertedAvailable = {
        min: min === 0 ? 0 : round(Math.max(min, getCurrencyUnit(currencyDecimals)), currencyDecimals),
        max: round(max, currencyDecimals),
        step,
    };

    const convertedDefaultBet = getDefaultBetFromRange(convertedAvailable, currencyDecimals, defaultBet || gameAction.default * currencyRate);

    return {
        available: convertedAvailable,
        default: convertedDefaultBet,
        coin: gameAction.coin,
    };
}
