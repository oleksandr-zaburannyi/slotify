import {BaseEntity, Column, CreateDateColumn, Entity, In, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer} from "typeorm";
import {getConnection} from "@slotify/shared/lib/dbOptions";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

@Entity()
export class Command extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @PrimaryColumn({type: "uuid"}) commandId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column("uuid") roomId!: string;
    @Column("uuid") roundId!: string;
    @Column() processed?: boolean;
    @Column("uuid") playerId!: string;
    @Column("uuid") drawId!: string;
    @Column({type: "bigint"}) time!: number;
    @Column() action!: string;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) bet?: number;
    @Column({nullable: true}) currency?: string;
    @Column({type: "jsonb", nullable: true}) params?: any;
    @Column({type: "bigint", nullable: true}) tickId?: number;
    @Column({nullable: true}) withdrawalStatus?: "finishing" | "finished" | "failed" | "cancelled";
    @Column({type: "jsonb", nullable: true}) data?: any;

    static async getByStatus(statuses: Command["withdrawalStatus"][]): Promise<Command[]> {
        return await getConnection("replica").manager.findBy(Command, {withdrawalStatus: In(statuses)});
    }
}
