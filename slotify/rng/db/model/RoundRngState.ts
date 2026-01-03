import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
export class RoundRngState extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "uuid"}) playerId!: string;
    @Column({type: "varchar"}) game!: string;
    @Column({type: "uuid"}) roundId!: string;
    @Column({type: "uuid"}) seedsId!: string;
    @Column({type: "int"}) nonce!: number;
    @Column({type: "int"}) cursor!: number;
    @Column({type: "varchar"}) status!: "active" | "closed";
}
