import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";
import {toInt} from "@slotify/shared/lib/valueTransformers";

@Entity()
export class StreamSnapshot<TAccumulationData> extends BaseEntity {
    @PrimaryGeneratedColumn("increment", {type: "bigint"}) id!: number;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @Column({type: "varchar"}) streamId!: string;
    @Column({type: "json"}) data!: TAccumulationData;
    @Column({type: "bigint", transformer: toInt}) accumulationIndex?: number;
}
