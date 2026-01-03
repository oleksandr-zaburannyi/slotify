import Stats from "./stats/Stats";
import {IRandom} from "@slotify/rng/lib/random/IRandom";
import {IRandomizationBuilder} from "@slotify/rng/lib/random/createProofBuilder";
import {IGameJackpotData, ITransactionJackpotData} from "./helper/jackpots";

export interface IPromo {
    transactionJackpot?: ITransactionJackpotData;
}

export interface ICampaigns {
    gameJackpot?: IGameJackpotData;
}

export interface IPlayRequest<TConfig = any, TState = any, TParams = any, TActions = string> {
    bet: number;
    sideBet?: number;
    action: TActions | null;
    params?: TParams;
    state?: TState;
    coin?: number;
    config?: TConfig;
    variant?: string;
    promo?: IPromo;
}

export interface IPlayResponse<TData = any, TState = any, TFeed = any> {
    win: number;
    state?: TState;
    data?: TData;
    next?: string[];
    feed?: TFeed;
    campaigns?: ICampaigns;
}

export interface IWager<TData = any, TState = any, TParams = any, TConfig = any, TActions = string> extends IPlayResponse<TData, TState>, IPlayRequest<TConfig, TState, TParams, TActions> {}

export interface IGameBet {
    available: number[] | {min: number; max: number; step: number};
    default: number;
    maxWin: number;
    coin: number;
    validate?: boolean;
}

export interface IGameBets {
    [key: string]: IGameBet;
}

export interface IBetLimits {
    minBet: number;
    maxBet: number;
    maxBonusBet: number;
    maxExposure: number;
    currencyRate: number;
    exchangeRate: number;
    currencyDecimals: number;
    currencyUnit: number;
}

export interface IGame<TData = any, TConfig = any, TState = any, TParams = any> {
    readonly name: string | string[];
    readonly bets: IGameBets | ((variant?: string) => IGameBets);
    readonly stats?: {[key: string]: Stats<any>};
    readonly cheats?: {[key: string]: {[key: string]: (wager: IWager<TData, TState, TParams, TConfig>) => boolean}};

    config?(variant?: string): TConfig;

    play(request: Partial<IPlayRequest<TConfig, TState, TParams>>, random: IRandom, betLimits?: IBetLimits): IPlayResponse<TData, TState>;

    validate?(request: IPlayRequest<TState, TParams>, betLimits: IBetLimits): boolean;

    action?(wager: IWager<TData, TState, TParams, TConfig>, random: IRandom): {action?: string; params?: any};

    simulate?(request: {strategy?: string; wagers: IWager<TData, TState, TParams, TConfig>[]; state?: any}, random: IRandom): {action?: string; params?: any; bet?: number; sideBet?: number};

    evaluate?(type: string | null, wagers: IWager<TData, TState, TParams, TConfig>[], data?: any): any;

    proveFairness?(addRandomization: IRandomizationBuilder, data?: any): void;
}
