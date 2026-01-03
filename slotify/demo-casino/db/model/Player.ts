import {BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn, ValueTransformer} from "typeorm";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

@Entity()
@Index("demo_player_token", ["token"], {unique: false})
export class Player extends BaseEntity {
    @PrimaryColumn() nativeId!: string;
    @CreateDateColumn({type: "timestamptz", select: false}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz", select: false}) updatedAt!: Date;
    @Column() currency!: string;
    @Column() operator!: string;
    @Column() brand!: string;
    @Column() token!: string;
    @Column({nullable: true}) nickname?: string;
    @Column({nullable: true}) gender?: string;
    @Column({nullable: true}) country?: string;
    @Column({nullable: true}) jurisdiction?: string;
    @Column({type: "decimal", transformer: toFloat}) balance!: number;
}
