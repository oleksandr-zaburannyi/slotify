import {BaseEntity, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer} from "typeorm";
import cache from "@slotify/shared/lib/cache";
import Exception from "@slotify/shared/lib/Exception";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

@Entity()
export class Room extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") roomId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @DeleteDateColumn({type: "timestamptz"}) deletedAt?: Date;
    @Column() name?: string;
    @Column() provider!: string;
    @Column() game!: string;
    @Column() enabled?: boolean;
    @Column({nullable: true}) secretKey?: string;
    @Column({type: "decimal", transformer: toFloat}) minBet?: number;
    @Column({type: "decimal", transformer: toFloat}) maxBet?: number;
    @Column({type: "jsonb"}) config!: any;
    @Column({type: "jsonb"}) currencies?: string[];
    @Column({type: "jsonb"}) wallets?: string[];
    @Column({type: "jsonb"}) operators?: string[];
    @Column({type: "jsonb"}) brands?: string[];
    @Column() variant?: string;
    @Column({type: "jsonb", nullable: true}) provablyFair?: {chainLength: number; seed: string; lastHash: string};

    static getRooms = cache(5 * 60, () => Room.find({withDeleted: true}), ["rooms"]);

    static async getByIdOrFail(roomId: string) {
        const rooms = await this.getRooms();
        const room = rooms.find(room => room.roomId === roomId);
        if (!room) throw new Exception(`Couldn't find room '${roomId}'`);
        return room;
    }
}
