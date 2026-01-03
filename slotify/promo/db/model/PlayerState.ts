import {BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
@Index("promo_player_state_campaignId_playerId", ["campaignId", "playerId"], {unique: true})
export class PlayerState extends BaseEntity {
    @PrimaryGeneratedColumn() public id!: string;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt?: Date;
    @Column({type: "json"}) public state?: any;
    @Column({type: "uuid"}) public campaignId!: string;
    @Column() public playerId!: string;
    @Column() public init!: boolean;
    @Column() public optIn!: boolean;
    @Column() public finished!: boolean;
    @Column() public acknowledged!: boolean;
}
