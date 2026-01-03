import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class PlayerCache extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") public id!: string;
    @Column() public playerId!: string;
    @Column() public game!: string;
    @Column({type: "jsonb"}) public campaignIds!: any;

    static async getActiveCampaigns(playerId: string, game: string): Promise<string[] | null> {
        return (await PlayerCache.findOneBy({playerId, game}))?.campaignIds;
    }

    static async saveActiveCampaigns(playerId: string, game: string, campaignIds: string[]) {
        await PlayerCache.delete({playerId, game});
        await PlayerCache.insert({playerId, game, campaignIds});
    }
}
