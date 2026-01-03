import {Campaign, Connector} from "../Connector";
import {IBetChangedMessageData, IStoppedMessageData, IWagerMessageData} from "../AsyncEventEmitter";

export interface IFreeBetsCampaignInfo {
    used: number;
    total: number;
}

export interface IPrizeDropCampaignInfo {
    left: number;
    total: number;
}

export interface ITournamentCampaignInfo {
    playerRank: number;
    totalPositions: number;
}

export interface IPromoToolUi {
    init(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}>;

    onExpired(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}>;

    onWager(connector: Connector, campaign: Campaign, data: IWagerMessageData): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}>;

    onStopped(connector: Connector, campaign: Campaign, data: IStoppedMessageData): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}>;

    onBetChanged(connector: Connector, campaign: Campaign, data: IBetChangedMessageData): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}>;

    getActiveCampaignId(): string | null;

    getActiveCampaignInfo(): IFreeBetsCampaignInfo | IPrizeDropCampaignInfo | ITournamentCampaignInfo | null;
}
