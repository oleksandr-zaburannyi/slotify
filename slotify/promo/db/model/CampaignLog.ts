import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class CampaignLog extends BaseEntity {
    @PrimaryGeneratedColumn() public id!: number;
    @Column({type: "timestamptz"}) public createdAt!: Date;
    @Column() public campaignId!: string;
    @Column() public name!: string;
    @Column({type: "jsonb"}) public data!: any;
}
