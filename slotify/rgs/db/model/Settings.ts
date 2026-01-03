import cache from "@slotify/shared/lib/cache";
import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import Exception from "@slotify/shared/lib/Exception";
import {IAvailableBets, IBetConfig} from "../../util/betUtil";

export interface ISettings {
    minBet?: string;
    maxBet?: string;
    maxBonusBet?: string;
    maxExposure?: string;
    useExchangeRateBetLimits?: "true";
    defaultBet?: string;
    gameVariant?: string;
    availableBets?: string;
    autoCompleteHours?: string;
    autoCompleteDisabled?: "true";
    provablyFair?: "true";
    winCap?: string;
    depositRetries?: string;
    cancelRetries?: string;
    retriesExpiryHours?: string;
    maxDecimals?: string;
    mainBets?: string;
    parallelRounds?: "true";
    gameEnabled?: "true" | "false";
    useCurrencySymbol?: "false";
}

export interface ISettingsFilter {
    wallet?: string;
    operator?: string;
    brand?: string;
    provider?: string;
    game?: string;
    jurisdiction?: string;
    currency?: string;
}

@Entity()
export class Settings extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column() settingId!: string;

    @Column({nullable: true, type: "json"}) wallets?: string[];
    @Column({nullable: true, type: "json"}) operators?: string[];
    @Column({nullable: true, type: "json"}) brands?: string[];
    @Column({nullable: true, type: "json"}) providers?: string[];
    @Column({nullable: true, type: "json"}) games?: string[];
    @Column({nullable: true, type: "json"}) jurisdictions?: string[];
    @Column({nullable: true, type: "json"}) currencies?: string[];

    @Column() key!: string;
    @Column({nullable: true}) value?: string;
    @Column({nullable: true, type: "varchar"}) comment?: string;

    @Column() priority!: number;
    @Column() serverOnly!: boolean;

    static getConfig = cache(2 * 60, () => Settings.find(), ["settings"]);

    static async getValues(filters: ISettingsFilter, onlyVisibleInClient: boolean = false): Promise<ISettings> {
        let settings = await Settings.getConfig();
        settings = settings.filter(item => !item.wallets || item.wallets.includes(filters.wallet as string));
        settings = settings.filter(item => !item.operators || item.operators.includes(filters.operator as string));
        settings = settings.filter(item => !item.brands || item.brands.includes(filters.brand as string));
        settings = settings.filter(item => !item.providers || item.providers.includes(filters.provider as string));
        settings = settings.filter(item => !item.games || item.games.includes(filters.game as string));
        settings = settings.filter(item => !item.jurisdictions || item.jurisdictions.includes(filters.jurisdiction as string));
        settings = settings.filter(item => !item.currencies || item.currencies.includes(filters.currency as string));

        if (onlyVisibleInClient) {
            settings = settings.filter(item => !item.serverOnly);
        }
        settings.sort((a, b) => b.priority - a.priority);

        const keys: Record<string, string | undefined> = {};
        settings.forEach(({key, value}) => {
            keys[key] = keys[key] || value;
        });
        return keys;
    }

    static async isAutoCompleteEnabled(filters: ISettingsFilter): Promise<boolean> {
        return (await this.getValues(filters)).autoCompleteDisabled !== "true";
    }

    static async getAutoCompleteTimestamp(filters: ISettingsFilter) {
        const expiryHours = parseFloat((await this.getValues(filters)).autoCompleteHours || "24");
        return Date.now() + expiryHours * 60 * 60 * 1000;
    }

    static async getNextDepositRetryTimestamp(filters: ISettingsFilter, retry: number) {
        const retries = ((await this.getValues(filters)).depositRetries || "60").split(",").map(i => parseFloat(i));
        return Date.now() + retries[Math.min(retry, retries.length - 1)] * 60 * 1000;
    }

    static async getNextCancelRetryTimestamp(filters: ISettingsFilter, retry: number) {
        const retries = ((await this.getValues(filters)).cancelRetries || "60").split(",").map(i => parseFloat(i));
        return Date.now() + retries[Math.min(retry, retries.length - 1)] * 60 * 1000;
    }

    static async hasRetriesExpired(date: Date, filters: ISettingsFilter) {
        return date.getTime() < (await this.getRetryExpired(filters)).getTime();
    }

    static async getRetryExpired(filters: ISettingsFilter) {
        const expiryHours = parseFloat((await this.getValues(filters)).retriesExpiryHours || "72");
        return new Date(Date.now() - expiryHours * 60 * 60 * 1000);
    }

    static async getCustomBets(filters: ISettingsFilter): Promise<void | Record<string, IAvailableBets>> {
        const availableBets = (await this.getValues(filters)).availableBets;
        if (!availableBets) return;
        try {
            return JSON.parse(availableBets);
        } catch (e) {
            throw new Exception("Couldn't parse custom bets", {data: {error: e}});
        }
    }

    static async getBetConfig(filters: ISettingsFilter): Promise<Partial<IBetConfig>> {
        const {minBet, maxBet, maxBonusBet, maxExposure, defaultBet} = await this.getValues(filters);

        return {
            minBet: minBet ? parseFloat(minBet) : undefined,
            maxBet: maxBet ? parseFloat(maxBet) : undefined,
            maxBonusBet: maxBonusBet ? parseFloat(maxBonusBet) : undefined,
            maxExposure: maxExposure ? parseFloat(maxExposure) : undefined,
            defaultBet: defaultBet ? parseFloat(defaultBet) : undefined,
        };
    }

    static async isProvablyFair(filters: ISettingsFilter) {
        return (await this.getValues(filters)).provablyFair === "true";
    }

    static async getMaxDecimals(filters: ISettingsFilter) {
        return parseInt((await this.getValues(filters)).maxDecimals || "2");
    }

    static async getWinCap(filters: ISettingsFilter) {
        const {winCap} = await this.getValues(filters);
        return winCap ? parseFloat(winCap) : null;
    }

    static async getMainBets(filters: ISettingsFilter) {
        const {mainBets} = await this.getValues(filters);
        return mainBets ? mainBets.split(",") : ["main"];
    }

    static async allowParallelRounds(filters: ISettingsFilter) {
        const {parallelRounds} = await this.getValues(filters);
        return parallelRounds === "true";
    }

    static async isGameEnebled(filters: ISettingsFilter) {
        const {gameEnabled} = await this.getValues(filters);
        return gameEnabled === "true";
    }

    static async useExchangeRateBetLimits(filters: ISettingsFilter) {
        const {useExchangeRateBetLimits} = await this.getValues(filters);
        return useExchangeRateBetLimits === "true";
    }

    static async useCurrencySymbol(filters: ISettingsFilter) {
        const {useCurrencySymbol} = await this.getValues(filters);
        return useCurrencySymbol === "false";
    }
}
