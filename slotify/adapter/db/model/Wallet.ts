import cache from "@slotify/shared/lib/cache";
import Exception from "@slotify/shared/lib/Exception";
import {BaseEntity, Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class Wallet extends BaseEntity {
    @PrimaryColumn() id!: string;
    @Column() adapter!: string;
    @Column() email?: string;
    @Column() group?: string;
    @Column() enabled!: boolean;
    @Column() keyCacheExpiry?: number;
    @Column() ipBlocked?: boolean;
    @Column() geoIpBlocked?: boolean;
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

    static async isIpBlocked(wallet: string): Promise<boolean> {
        const {ipBlocked} = await Wallet.getById(wallet);
        return !!ipBlocked;
    }

    static async isGeoIpBlocked(wallet: string): Promise<boolean> {
        const {geoIpBlocked} = await Wallet.getById(wallet);
        return !!geoIpBlocked;
    }

    static async isOneTimeKeyBlocked(wallet: string): Promise<boolean> {
        const {oneTimeKeyBlocked} = await Wallet.getById(wallet);
        return !!oneTimeKeyBlocked;
    }
}
