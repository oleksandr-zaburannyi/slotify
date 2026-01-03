import {BaseEntity, Column, Entity} from "typeorm";
import {PrimaryColumn} from "typeorm/decorator/columns/PrimaryColumn";
import cache from "@slotify/shared/lib/cache";
import Exception from "@slotify/shared/lib/Exception";

@Entity()
export class Game extends BaseEntity {
    @PrimaryColumn() game!: string;
    @Column() title?: string;
    @Column({type: "varchar"}) type?: "live" | "lottery" | "poker" | "slot" | "tableGame" | "videoPoker" | "other";
    @Column() provider!: string;
    @Column() rgs!: string;
    @Column() rgsGame?: string;
    @Column({type: "json"}) inspectionConfig?: any;
    @Column({type: "json"}) rgsConfig?: any;
    @Column({type: "jsonb", nullable: true}) wallets?: string[];
    @Column({type: "jsonb", nullable: true}) operators?: string[];
    @Column({type: "jsonb", nullable: true}) brands?: string[];

    static allGames = cache(5 * 60, async () => await Game.findBy({}), ["games"]);

    static async get(game: string) {
        const details = (await this.allGames()).find(item => item.game === game);
        if (!details) throw new Exception("Game not available", {data: {game}});
        return {title: details.title, provider: details.provider, rgs: details.rgs, rgsConfig: details.rgsConfig};
    }

    static async verify(game: string, wallet: string, operator: string, brand?: string) {
        const item = (await this.allGames()).find(item => item.game === game);
        if (!item) return false;
        if (item.wallets && !item.wallets.includes(wallet)) return false;
        if (item.operators && !item.operators.includes(operator)) return false;
        if (brand && item.brands && !item.brands.includes(brand)) return false;

        return true;
    }

    static async toRgs(game: string) {
        const item = (await this.allGames()).find(item => item.game === game);
        return item?.rgsGame || game;
    }

    static async fromRgs(rgs: string, rgsGame: string) {
        const item = (await this.allGames()).find(item => item.rgs === rgs && item.rgsGame === rgsGame);
        return item?.game || rgsGame;
    }

    static removeProviderPrefix(config: {includeProviderInGame?: boolean}, game: string) {
        if (config.includeProviderInGame) {
            return game.split(":").at(-1)!;
        }
        return game;
    }

    static addProviderPrefix(config: {includeProviderInGame?: boolean}, provider: string, game: string) {
        if (config.includeProviderInGame) {
            return provider + ":" + game;
        }
        return game;
    }
}
