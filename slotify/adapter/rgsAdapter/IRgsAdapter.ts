import {Express, Request} from "express";

interface IAddFreeBetsRequest {
    walletCampaignId: string;
    games: string[];
    nativeIds: string[];
    start?: number;
    end?: number;
    bets: number;
    amount: number;
    currency: string;
}

interface IAvailableBetsRequest {
    games: string[];
    currencies: string[];
}

export interface IRgsAdapter<TConfig = any> {
    init: (provider: string, api: Express, basePath: string, config: TConfig) => void;
    launch: (mode: "real" | "fun" | "replay", config: TConfig, params: Record<string, string>, req?: Request) => Promise<string>;

    addFreeBets?: (request: IAddFreeBetsRequest, rgsConfig: TConfig, wallet: string, operator: string, brand: string) => Promise<string>;
    removeFreeBets?: (walletCampaignId: string, rgsConfig: TConfig, wallet: string, operator: string, brand: string) => Promise<string>;
    availableBets?: (request: IAvailableBetsRequest, rgsConfig: TConfig, wallet: string, operator: string, brand: string) => Promise<{[game: string]: {[currency: string]: number[]}}>;
}
