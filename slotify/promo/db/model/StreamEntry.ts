import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {toInt} from "@slotify/shared/lib/valueTransformers";

export type IStreamEntry<TEntryData> = {id: number; data: TEntryData};

@Entity()
export class StreamEntry<TEntryData> extends BaseEntity implements IStreamEntry<TEntryData> {
    @PrimaryGeneratedColumn("increment", {type: "bigint"}) id!: number;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt?: Date;
    @Column({type: "varchar"}) streamId!: string;
    @Column({type: "json"}) data!: TEntryData;
    @Column({type: "boolean", default: false}) processed!: boolean;
    @Column({type: "bigint", transformer: toInt}) accumulationIndex?: number;
}
