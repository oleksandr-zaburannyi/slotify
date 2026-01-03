import {getGameBets} from "./betUtil";
import {ISettingsFilter, Settings} from "../db/model/Settings";
import {Currency} from "../db/model/Currency";
import {floor} from "@slotify/shared/lib/floor";

export async function maxWin(provider: string | undefined, game: string, variant: string | undefined, action: string) {
    const bets = await getGameBets(provider, game, variant);
    return bets[action].maxWin;
}

export async function winRatio(provider: string | undefined, game: string, variant: string | undefined, action: string, bet: number, win: number) {
    if (!bet) return null;
    const bets = await getGameBets(provider, game, variant);
    const mainBet = bets["main"] || bets[action];

    const winRatio = ((bets[action].coin / mainBet.coin) * win) / bet;

    return Number(winRatio.toFixed(8));
}

export async function isBaseBet(provider: string | undefined, game: string, variant: string | undefined, action: string) {
    const bets = await getGameBets(provider, game, variant);
    const mainBet = bets["main"] || bets[action];
    return bets[action].coin / mainBet.coin === 1;
}

export async function calculateFinalWin(win: number, settingsFilter: ISettingsFilter) {
    const winCap = await Settings.getWinCap(settingsFilter);
    const {rate, decimals} = await Currency.getFixedRate(settingsFilter.currency!, settingsFilter);
    if (winCap !== null) {
        win = Math.min(win, winCap * rate);
    }
    win = floor(win, decimals);

    return win;
}
