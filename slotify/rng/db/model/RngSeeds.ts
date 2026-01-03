import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
export class RngSeeds extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") seedsId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "uuid"}) playerId!: string;
    @Column({type: "varchar", length: 64}) clientSeed!: string;
    @Column({type: "varchar", length: 64}) serverSeed!: string;
    @Column({type: "varchar", length: 64}) serverSeedHash!: string;
    @Column({type: "varchar"}) status!: "active" | "revealed";
    @Column({type: "varchar", length: 64}) nextServerSeed!: string;
    @Column({type: "varchar", length: 64}) nextServerSeedHash!: string;
}
