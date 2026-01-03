import {getTool, IToolType} from "../../tools/tools";
import {BaseEntity, Column, CreateDateColumn, DeepPartial, Entity, EntityManager, In, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {PlayerState} from "./PlayerState";
import Exception from "@slotify/shared/lib/Exception";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {CampaignState} from "./CampaignState";
import {IPlayer} from "../../util/routes";
import {ITool} from "../../util/ITool";
import {CampaignLog} from "./CampaignLog";
import {CampaignPrize} from "./CampaignPrize";
import {PlayerCache} from "./PlayerCache";
import {lazyLoadState} from "../../util/states";

export interface CampaignData {
    campaignId: string;
    start: Date;
    end: Date;
    config: any;
    type: string;
    name: string;
    walletCampaignId: string;
    status: "planned" | "started" | "active" | "finished";
    tool: ITool;
}

@Entity()
export class Campaign extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") public campaignId!: string;
    @Column() public name!: string;
    @Column({type: "varchar", nullable: true}) public walletCampaignId?: string;
    @Column({type: "varchar"}) public type!: IToolType;
    @Column({type: "json", nullable: true}) public config!: any;

    @CreateDateColumn({type: "timestamptz"}) public createdAt?: Date;
    @UpdateDateColumn({type: "timestamptz"}) public updatedAt?: Date;
    @Column({type: "timestamptz", nullable: true}) public start?: Date | null;
    @Column({type: "timestamptz", nullable: true}) public end?: Date | null;

    @Column({nullable: true}) public enabled?: boolean;

    @Column({type: "varchar", nullable: true}) public themeId?: string | null;

    @Column({type: "json", nullable: true}) public wallets?: string[];
    @Column({type: "json", nullable: true}) public operators?: string[];
    @Column({type: "json", nullable: true}) public brands?: string[];
    @Column({type: "json", nullable: true}) public providers?: string[];
    @Column({type: "json", nullable: true}) public games?: string[];
    @Column({type: "json", nullable: true}) public playerIds?: string[];
    @Column({type: "json", nullable: true}) public nativeIds?: string[];
    @Column({type: "json", nullable: true}) public currencies?: string[];

    static async getById(campaignId: string, player: IPlayer): Promise<CampaignData> {
        const campaign = (await Campaign.getAll(player, campaignId))[0];
        if (!campaign) throw new Exception("Couldn't find campaign", {data: {campaignId, player}});

        return campaign;
    }

    static async getAll(player: IPlayer, campaignId?: string, invalidateCache = false, campaignTypes?: IToolType[]): Promise<CampaignData[]> {
        const {playerId, nativeId, operator, brand, game, provider, wallet, currency} = player;
        let cachedCampaignIds;

        if (!invalidateCache) {
            cachedCampaignIds = await PlayerCache.getActiveCampaigns(playerId, game);
            if (cachedCampaignIds?.length === 0) return [];
        }
        const campaignsQuery = getConnection("primary")
            .createQueryBuilder(Campaign, "campaign")
            .select(`campaign."campaignId"`, "campaignId")
            .addSelect([`"start"`, `"end"`, `"config"`, `"type"`, `"walletCampaignId"`, `"name"`, `"optIn"`, `"finished"`, `"acknowledged"`])
            .addSelect(
                `case
                                    when "finished" is true then 'finished'
                                    when ("end" is not null and "end" < now()) then 'finished'
                                    when ("start" is not null and "start" > now()) then 'planned'
                                    when "optIn" is true then 'active'
                                    else 'started'
                                 end as "status"
             `,
            )
            .where(`"enabled" is true`)
            .andWhere(`"acknowledged" is not true`)
            .andWhere(`("optIn" is true or "end" >= now() or "end" is null)`)
            .andWhere(`COALESCE("playerIds", '["*"]') ?| array[:...playerIds]`, {playerIds: [playerId, "*"]})
            .andWhere(`COALESCE("nativeIds", '["*"]') ?| array[:...nativeIds]`, {nativeIds: [nativeId, "*"]})
            .andWhere(`COALESCE("wallets", '["*"]') ?| array[:...wallets]`, {wallets: [wallet, "*"]})
            .andWhere(`COALESCE("operators", '["*"]') ?| array[:...operators]`, {operators: [operator, "*"]})
            .andWhere(`COALESCE("brands", '["*"]') ?| array[:...brands]`, {brands: [brand, "*"]})
            .andWhere(`COALESCE("providers", '["*"]') ?| array[:...providers]`, {providers: [provider, "*"]})
            .andWhere(`COALESCE("games", '["*"]') ?| array[:...games]`, {games: [game, "*"]})
            .andWhere(`COALESCE("currencies", '["*"]') ?| array[:...currencies]`, {currencies: [currency, "*"]})
            .andWhere("player_state.optIn is not false")
            .leftJoin(PlayerState, "player_state", 'player_state."campaignId"=campaign."campaignId" AND :playerId = "playerId"', {playerId})
            .orderBy(`campaign."start"`, "ASC", "NULLS FIRST")
            .addOrderBy(`campaign."createdAt"`, "ASC");

        if (campaignId) {
            campaignsQuery.andWhere({campaignId});
        }
        if (campaignTypes) {
            campaignsQuery.andWhere({type: In(campaignTypes)});
        }
        if (cachedCampaignIds) {
            campaignsQuery.andWhere({campaignId: In(cachedCampaignIds)});
        }

        const campaigns = (await campaignsQuery.getRawMany()).map(campaign => ({...campaign, tool: getTool(campaign.type)}));

        let visibleCampaigns = campaigns;
        if (invalidateCache) {
            visibleCampaigns = [];
            for (const campaign of campaigns) {
                const {loadCampaignState, loadPlayerState} = lazyLoadState(getConnection("primary").manager, campaign.campaignId, playerId, true);

                if (!campaign.tool.visible || (await campaign.tool.visible({config: campaign.config, player, loadCampaignState, loadPlayerState}))) {
                    visibleCampaigns.push(campaign);
                }
            }

            await PlayerCache.saveActiveCampaigns(
                playerId,
                game,
                visibleCampaigns.map(c => c.campaignId),
            );
        }

        const uniqueVisibleCampaigns: CampaignData[] = [];
        for (const visibleCampaign of visibleCampaigns) {
            if (!uniqueVisibleCampaigns.some(campaign => campaign.type === visibleCampaign.type)) {
                uniqueVisibleCampaigns.push(visibleCampaign);
            }
        }

        return uniqueVisibleCampaigns;
    }

    static async forceActive(campaignId: string): Promise<CampaignData | null> {
        const campaign: any = await Campaign.findOne({where: {campaignId}, select: ["campaignId", "start", "end", "config", "type", "name", "walletCampaignId"]});

        return campaign ? {...campaign, status: "active", tool: getTool(campaign.type)} : null;
    }

    static async createWithState(data: DeepPartial<Campaign>, state?: any, manager: EntityManager = getConnection("primary").manager) {
        const campaign = await manager.save(Campaign, Campaign.create(data));
        await manager.save(CampaignState, CampaignState.create({campaignId: campaign.campaignId, state}));
        return campaign;
    }

    static async updateWithState(campaignId: string, data: DeepPartial<Campaign>, state?: any, manager: EntityManager = getConnection("primary").manager) {
        const criteria = {campaignId};
        await manager.update(Campaign, criteria, data);
        await manager.update(CampaignState, criteria, {state});
    }

    static async deleteCascade(campaignId: string) {
        await CampaignLog.delete({campaignId});
        await PlayerState.delete({campaignId});
        await CampaignState.delete({campaignId});
        await CampaignPrize.delete({campaignId});
        await Campaign.delete({campaignId});
    }
}
