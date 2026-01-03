import FreeBetsIcon from "./icon/FreeBetsIcon";
import {Campaign, Connector} from "../Connector";
import i18next from "i18next";
import {IFreeBetsCampaignInfo, IPromoToolUi} from "./IPromoToolUi";
import FreeBetsHeaderIcon from "./icon/FreeBetsHeaderIcon";

export class FreeBetsUi implements IPromoToolUi {
    private activeCampaignId: string | null = null;
    private activeCampaignInfo: IFreeBetsCampaignInfo | null = null;

    public async init(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, playerState} = await connector.getCampaign(campaign.campaignId, true);

        if (campaign.status === "started") {
            return new Promise(resolve => {
                this.showStartedCampaignPopup(connector, campaign, config, playerState, resolve);
            });
        } else if (campaign.status === "finished") {
            connector.callbacks?.stopAutoplay && connector.callbacks.stopAutoplay();
            this.updateActiveCampaignHeader(connector, campaign, config, playerState);

            return new Promise(resolve => {
                this.showFinishedCampaignPopup(connector, campaign.campaignId, playerState, resolve);
            });
        } else if (campaign.status === "active") {
            connector.callbacks?.freezeBet && connector.callbacks.freezeBet(playerState.amount);
            this.updateActiveCampaignHeader(connector, campaign, config, playerState);
            this.activeCampaignId = campaign.campaignId;
            return new Promise(resolve => {
                this.showActiveCampaignPopup(connector, campaign, playerState, resolve);
            });
        }

        return {shouldIgnore: false, shouldRefresh: false};
    }

    public async onExpired(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, playerState} = await connector.getCampaign(campaign.campaignId);
        connector.callbacks?.stopAutoplay && connector.callbacks.stopAutoplay();
        this.updateActiveCampaignHeader(connector, campaign, config, playerState);

        return new Promise(resolve => {
            this.showFinishedCampaignPopup(connector, campaign.campaignId, playerState, resolve);
        });
    }

    public async onWager(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        if (campaign.status === "active") {
            const {config, playerState} = await connector.getCampaign(campaign.campaignId);

            connector.callbacks?.freezeBet && connector.callbacks.freezeBet(playerState.amount);
            this.updateActiveCampaignHeader(connector, campaign, config, playerState);
        }

        return {shouldIgnore: false, shouldRefresh: false};
    }

    public async onStopped(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, playerState} = await connector.getCampaign(campaign.campaignId);

        if (campaign.status === "started") {
            return new Promise(resolve => {
                this.showStartedCampaignPopup(connector, campaign, config, playerState, resolve);
            });
        } else if (campaign.status === "active") {
            this.updateActiveCampaignHeader(connector, campaign, config, playerState);
        } else if (campaign.status === "finished") {
            connector.callbacks?.stopAutoplay && connector.callbacks.stopAutoplay();
            this.updateActiveCampaignHeader(connector, campaign, config, playerState);

            return new Promise(resolve => {
                this.showFinishedCampaignPopup(connector, campaign.campaignId, playerState, resolve);
            });
        }

        return {shouldIgnore: false, shouldRefresh: false};
    }

    private showStartedCampaignPopup(connector: Connector, campaign: Campaign, config: any, playerState: any, resolve: (value: any) => void) {
        const optOutButton =
            connector.settings.closePromoOptOut === "true"
                ? {
                      label: i18next.t("close"),
                      secondary: true,
                      callback: async () => {
                          resolve({shouldIgnore: true, shouldRefresh: false});
                      },
                  }
                : {
                      label: i18next.t("optOut"),
                      secondary: true,
                      callback: async () => {
                          await connector.optCampaign(campaign.campaignId, false);
                          resolve({shouldIgnore: false, shouldRefresh: true});
                      },
                  };
        const playButton = {
            label: i18next.t("start"),
            primary: true,
            callback: async () => {
                await connector.optCampaign(campaign.campaignId, true);
                this.updateActiveCampaignHeader(connector, campaign, config, playerState);
                connector.callbacks?.freezeBet && connector.callbacks.freezeBet(playerState.amount);
                this.activeCampaignId = campaign.campaignId;
                resolve({shouldIgnore: false, shouldRefresh: false});
            },
        };
        const buttons = connector.settings.hidePromoOptOut === "true" ? [playButton] : [optOutButton, playButton];

        connector.ui().showPopup({
            title: i18next.t("freeBetsIntroTitle"),
            message: (
                <div style={{marginTop: -35, overflowX: "hidden", overflowY: "auto"}}>
                    <>
                        <FreeBetsIcon fill={connector.ui().getTheme().global!.colors!["background-back"] as string} stroke={connector.ui().getTheme().global!.colors!["control"] as string} />
                        {i18next.t("freeBetsIntroMessage", {spins: config.bets, bet: connector.formatCurrency(playerState.amount)})}
                        {campaign.end ? (
                            <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                                <>
                                    {i18next.t("freeBetsStartedEndDateMessage")}
                                    <b>{new Date(campaign.end).toLocaleString()}</b>
                                </>
                            </div>
                        ) : (
                            <></>
                        )}
                    </>
                </div>
            ),
            buttons,
        });
    }

    private showFinishedCampaignPopup(connector: Connector, campaignId: string, playerState: any, resolve: (value: any) => void) {
        connector.ui().showPopup({
            title: i18next.t("freeBetsFinishedTitle"),
            message: <>{i18next.t("freeBetsFinishedMessage", {spins: playerState.used, win: connector.formatCurrency(playerState.totalWin)})}</>,
            buttons: [
                {
                    label: i18next.t("continue"),
                    primary: true,
                    callback: async () => {
                        await connector.acknowledgeCampaign(campaignId);
                        connector.ui().removePromoHeader("freeBets");
                        connector.callbacks?.unfreezeBet && connector.callbacks.unfreezeBet();
                        this.activeCampaignId = null;
                        resolve({shouldIgnore: false, shouldRefresh: true});
                    },
                },
            ],
        });
    }

    private showActiveCampaignPopup(connector: Connector, campaign: Campaign, playerState: any, resolve?: (value: any) => void) {
        connector.ui().showPopup({
            title: i18next.t("freeBetsFinishedTitle"),
            message: (
                <>
                    {i18next.t("freeBetsFinishedMessage", {spins: playerState.used, win: connector.formatCurrency(playerState.totalWin)})}
                    {campaign.end ? (
                        <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                            <>
                                {i18next.t("freeBetsStartedEndDateMessage")}
                                <b>{new Date(campaign.end).toLocaleString()}</b>
                            </>
                        </div>
                    ) : (
                        <></>
                    )}
                </>
            ),
            buttons: [
                {
                    label: i18next.t("continue"),
                    primary: true,
                    callback: resolve ? () => resolve({shouldIgnore: false, shouldRefresh: false}) : async () => null,
                },
            ],
        });
    }

    private updateActiveCampaignHeader(connector: Connector, campaign: Campaign, config: any, playerState: any) {
        const used = playerState?.used || 0;
        const total = config.bets;

        connector.ui().addPromoHeader("freeBets", FreeBetsHeaderIcon, `${used}/${total}`, i18next.t("freeBetsSpins"), () => this.showActiveCampaignPopup(connector, campaign, playerState));

        this.activeCampaignInfo = {used, total};
    }

    public async onBetChanged(): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        return {shouldIgnore: false, shouldRefresh: false};
    }

    public getActiveCampaignId() {
        return this.activeCampaignId;
    }

    public getActiveCampaignInfo() {
        return this.activeCampaignInfo;
    }
}
