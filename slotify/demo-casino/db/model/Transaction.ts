import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn} from "typeorm";
import {toFloat} from "@slotify/shared/lib/valueTransformers";

@Entity()
export class Transaction extends BaseEntity {
    @PrimaryColumn() transactionId!: string;
    @Column() roundId!: string;
    @Column() roundFinished!: boolean;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column() type!: string;
    @Column({type: "decimal", transformer: toFloat}) amount!: number;
    @Column({default: false}) cancelled!: boolean;
}
