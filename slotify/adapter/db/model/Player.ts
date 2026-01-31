import Exception from "@slotify/shared/lib/Exception";
import {BaseEntity, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {Transaction} from "./Transaction";
import {executeInQueue} from "@slotify/shared/lib/queue";
import {CurrencyAlias} from "./CurrencyAlias";

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

    static async getOrCreate(nativeId: string, wallet: string, operator: string, nativeUser: INativeUser): Promise<Player> {
        return await executeInQueue(`player-get-or-create:${wallet}:${nativeId}`, async () => {
            let player = await Player.findOneBy({nativeId, wallet});
            if (!player) {
                player = await Player.create({...nativeUser, nativeId, operator, wallet}).save();
            } else {
                if (player.currency !== nativeUser.currency) {
                    if (!(await CurrencyAlias.findOneBy({currency: player.currency, alias: nativeUser.currency, multiplier: 1}))) {
                        throw new Exception("Player currency cannot be changed", {data: {player, nativeId, wallet, operator, nativeUser}});
                    }
                }

                await Player.update({nativeId, wallet}, {operator, ...nativeUser});
            }
            return player;
        });
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
