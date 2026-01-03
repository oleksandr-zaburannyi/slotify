import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class DrawRngHash extends BaseEntity {
    @PrimaryGeneratedColumn("increment", {type: "bigint"}) id!: number;
    @Column({type: "uuid"}) roomId!: string;
    @Column({type: "varchar", length: 64}) hash!: string;
    @Column({type: "int"}) index!: number;
    @Column({type: "int", default: 0}) cursor!: number;
    @Column({type: "uuid", nullable: true}) drawId?: string;
}
