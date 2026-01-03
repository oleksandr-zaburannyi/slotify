import cache from "@slotify/shared/lib/cache";
import Exception from "@slotify/shared/lib/Exception";
import {BaseEntity, Column, Entity, PrimaryColumn} from "typeorm";

function normaliseTerritoryCode(countryOrRegion: string) {
    return countryOrRegion.toLowerCase().replace("-", "");
}

@Entity()
export class Wallet extends BaseEntity {
    @PrimaryColumn() id!: string;
    @Column() adapter!: string;
    @Column() email?: string;
    @Column() group?: string;
    @Column() enabled!: boolean;
    @Column() keyCacheExpiry?: number;
    @Column({type: "json"}) ipBlockedCountries?: string[];
    @Column({type: "json"}) ipBlockedRegions?: string[];
    @Column({type: "json"}) apiBlockedCountries?: string[];
    @Column() oneTimeKeyBlocked?: boolean;
    @Column() parallelTransactions?: boolean;
    @Column({type: "json"}) config: any;
    @Column({type: "json"}) inspectionConfig?: any;
    @Column({type: "json"}) ips?: string[];

    static getWallets = cache(5 * 60, () => Wallet.find(), ["wallets"]);

    static async getById(id: string): Promise<Wallet> {
        const wallets = await Wallet.getWallets();
        const wallet = wallets.find(wallet => wallet.id === id);
        if (!wallet) throw new Exception("Couldn't find wallet", {data: {id}});
        return wallet;
    }

    static async getKeyCacheExpiry(wallet: string): Promise<number | undefined> {
        const {keyCacheExpiry} = await Wallet.getById(wallet);
        return keyCacheExpiry;
    }

    static async isTerritoryBlocked(wallet: string, ipCountry?: string, ipRegion?: string, playerCountry?: string): Promise<boolean> {
        const {ipBlockedCountries, ipBlockedRegions, apiBlockedCountries} = await Wallet.getById(wallet);

        return !!(
            (ipCountry && (ipBlockedCountries || []).find(value => normaliseTerritoryCode(value) === normaliseTerritoryCode(ipCountry))) ||
            (ipRegion && (ipBlockedRegions || []).find(value => normaliseTerritoryCode(value) === normaliseTerritoryCode(ipRegion))) ||
            (playerCountry && (apiBlockedCountries || []).find(value => normaliseTerritoryCode(value) === normaliseTerritoryCode(playerCountry)))
        );
    }

    static async isOneTimeKeyBlocked(wallet: string): Promise<boolean> {
        const {oneTimeKeyBlocked} = await Wallet.getById(wallet);
        return !!oneTimeKeyBlocked;
    }
}
