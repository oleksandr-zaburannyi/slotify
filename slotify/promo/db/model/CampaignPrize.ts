import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {getConnection} from "@slotify/shared/lib/dbOptions";

@Entity()
export class CampaignPrize extends BaseEntity {
    @PrimaryGeneratedColumn() public id!: number;
    @Column({type: "timestamptz"}) public createdAt!: Date;
    @Column() public campaignId!: string;
    @Column() public playerId!: string;
    @Column() public type!: string;
    @Column({type: "json"}) public data!: any;
    @Column() public paid!: boolean;
    @Column({nullable: true}) public comment?: string;

    static async getToPay() {
        return await getConnection("replica").manager.findBy<CampaignPrize>(CampaignPrize, {paid: false});
    }
}
