import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
export class RoomRngSeed extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "uuid"}) roomId!: string;
    @Column({type: "int"}) chainLength!: number;
    @Column({type: "int", default: 0}) activeIndex!: number;
    @Column({type: "varchar", length: 64, nullable: true}) lastHash?: string;
    @Column({type: "varchar", length: 64, nullable: true}) seed?: string;
}
