import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
export class SystemCommand extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @PrimaryColumn({type: "uuid"}) commandId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column("uuid") roomId!: string;
    @Column() processed?: boolean;
    @Column("uuid") systemId!: string;
    @Column("uuid") drawId!: string;
    @Column({type: "bigint"}) time!: number;
    @Column() action!: string;
    @Column({type: "jsonb", nullable: true}) params?: any;
    @Column({type: "bigint", nullable: true}) tickId?: number;
    @Column({type: "jsonb", nullable: true}) data?: any;
}
