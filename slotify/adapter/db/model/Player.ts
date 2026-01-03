import Exception from "@slotify/shared/lib/Exception";
import {BaseEntity, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {Transaction} from "./Transaction";

interface INativeUser {
    currency: string;
    brand?: string;
    country?: string;
    nickname?: string;
    gender?: string;
    jurisdiction?: string;
}

@Entity()
export class Player extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column() nativeId!: string;
    @Column() currency!: string;
    @Column() operator!: string;
    @Column() wallet!: string;
    @Column() brand?: string;
    @Column() group?: string;
    @Column({nullable: true}) nickname?: string;
    @Column({nullable: true}) gender?: string;
    @Column({nullable: true}) country?: string;
    @Column({nullable: true}) jurisdiction?: string;
    @Column({type: "boolean", transformer: {from: value => value || null, to: value => value || null}}) blocked!: boolean | null;

    @OneToMany(() => Transaction, transaction => transaction.player) transactions!: Transaction[];

    static async getOrCreate(nativeId: string, wallet: string, operator: string, {currency, ...nativeUser}: INativeUser): Promise<Player> {
        let player = await Player.findOneBy({nativeId, wallet});
        if (!player) {
            player = await Player.create({...nativeUser, currency, nativeId, operator, wallet}).save();
        } else {
            if (currency && player.currency !== currency) throw new Exception("Player currency cannot be changed", {data: {player, nativeId, wallet, operator, currency, nativeUser}});
            await Player.update({nativeId, wallet}, {operator, ...nativeUser});
        }
        return player;
    }

    static async getById(id: string): Promise<Player> {
        const player = await Player.findOneBy({id});
        if (!player) throw new Exception("Couldn't find a player", {data: {id}});
        return player;
    }

    static async getByNativeId(wallet: string, nativeId: string): Promise<Player> {
        const player = await Player.findOneBy({wallet, nativeId});
        if (!player) throw new Exception("Couldn't find a player", {data: {wallet, nativeId}});
        return player;
    }
}
