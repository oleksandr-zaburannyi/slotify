import {BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
@Index("promo_campaign_state_campaignId", ["campaignId"], {unique: true})
export class CampaignState extends BaseEntity {
    @PrimaryGeneratedColumn() public id!: string;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt?: Date;
    @Column({type: "json"}) public state?: any;
    @Column({type: "uuid"}) public campaignId!: string;
    @Column() public ended!: boolean;
}
