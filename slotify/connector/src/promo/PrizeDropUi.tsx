import {Campaign, Connector} from "../Connector";
import i18next from "i18next";
import PrizeDropIcon from "./icon/PrizeDropIcon";
import {IBetChangedMessageData, IStoppedMessageData} from "../AsyncEventEmitter";
import {IPrizeDropCampaignInfo, IPromoToolUi} from "./IPromoToolUi";
import {Button, Grommet, Tab, Tabs} from "grommet";
import {findMinimalQualifyingBet} from "../util/findMinimalQualifyingBet";
import PrizeDropHeaderIcon from "./icon/PrizeDropHeaderIcon";
import {getItemDisplayValue} from "../util/getItemDisplayValue";

export class PrizeDropUi implements IPromoToolUi {
    private activeBet?: number;
    private activeCampaignId: string | null = null;
    private activeCampaignInfo: IPrizeDropCampaignInfo | null = null;

    public async init(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, campaignState, playerState} = await connector.getCampaign(campaign.campaignId, true);

        if (campaign.status === "started") {
            return new Promise(resolve => {
                this.showStartedCampaignPopup(connector, campaign, config, campaignState, playerState, resolve);
            });
        } else if (campaign.status === "finished") {
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);

            await new Promise(resolve => this.showFinishedCampaignPopup(connector, campaign.campaignId, resolve));
            return {shouldIgnore: false, shouldRefresh: true};
        } else if (campaign.status === "active") {
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);
            this.activeCampaignId = campaign.campaignId;
            return new Promise(resolve => {
                this.showActiveCampaignPopup(connector, campaign, config, campaignState, playerState, resolve);
            });
        }

        return {shouldIgnore: false, shouldRefresh: false};
    }

    public async onExpired(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, campaignState, playerState} = await connector.getCampaign(campaign.campaignId);
        this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);

        await new Promise(resolve => this.showFinishedCampaignPopup(connector, campaign.campaignId, resolve));
        return {shouldIgnore: false, shouldRefresh: true};
    }

    public async onWager(): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        return {shouldIgnore: false, shouldRefresh: false};
    }

    public async onStopped(connector: Connector, campaign: Campaign, {roundId}: IStoppedMessageData): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, campaignState, playerState} = await connector.getCampaign(campaign.campaignId);

        if (campaign.status === "started") {
            return new Promise(resolve => {
                this.showStartedCampaignPopup(connector, campaign, config, campaignState, playerState, resolve);
            });
        }

        if (campaign.status === "active" || campaign.status === "finished") {
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);

            const lastPrizeWon = playerState?.prizesWon[playerState.prizesWon.length - 1];

            if (lastPrizeWon && roundId === lastPrizeWon.roundId) {
                await new Promise(resolve => this.showPrizeWonPopup(connector, lastPrizeWon, resolve));
            }
        }

        if (campaign.status === "finished") {
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);

            await new Promise(resolve => this.showFinishedCampaignPopup(connector, campaign.campaignId, resolve));

            return {shouldIgnore: false, shouldRefresh: true};
        }

        return {shouldIgnore: false, shouldRefresh: false};
    }

    public async onBetChanged(connector: Connector, campaign: Campaign, data: IBetChangedMessageData): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        this.activeBet = data.bet;

        if (campaign.status !== "planned") {
            const {config, campaignState, playerState} = await connector.getCampaign(campaign.campaignId);
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);
        }

        return {shouldIgnore: false, shouldRefresh: false};
    }

    private showActiveCampaignPopup(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any, resolve: (value: any) => void) {
        const playButton = {
            label: i18next.t("start"),
            primary: true,
            callback: async () => {
                resolve({shouldIgnore: false, shouldRefresh: false});
            },
        };

        connector.ui().showPopup({
            title: i18next.t("prizeDropStartedTitle"),
            message: this.getPopupContent(connector, campaign, config, campaignState, playerState),
            buttons: [playButton],
        });
    }

    private showStartedCampaignPopup(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any, resolve: (value: any) => void) {
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
                this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);
                this.activeCampaignId = campaign.campaignId;
                resolve({shouldIgnore: false, shouldRefresh: false});
            },
        };
        const buttons = connector.settings.hidePromoOptOut === "true" ? [playButton] : [optOutButton, playButton];

        connector.ui().showPopup({
            title: i18next.t("prizeDropStartedTitle"),
            message: this.getPopupContent(connector, campaign, config, campaignState, playerState),
            buttons,
        });
    }

    private getPopupContent(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any) {
        const prizesToShow = config.prizes
            .map((prize: any, index: number) => ({...prize, prizeIndex: index, amountLeft: campaignState.amountsLeft[index]}))
            .filter((detailedPrize: any) => detailedPrize.amountLeft > 0)
            .slice(0, 3);

        const prizesNotShownLeft = campaignState.amountsLeft.reduce((sum: number, amountLeft: any) => sum + amountLeft, 0) - prizesToShow.reduce((sum: number, detailedPrize: any) => sum + detailedPrize.amountLeft, 0);

        const minimalQualifyingBet = findMinimalQualifyingBet(connector.bets, playerState);

        return (
            <div style={{marginTop: -20, overflowX: "hidden", overflowY: "auto"}}>
                <>
                    <PrizeDropIcon fill={connector.ui().getTheme().global!.colors!["background-back"] as string} stroke={connector.ui().getTheme().global!.colors!["control"] as string} />
                    <div style={{marginTop: 10}}>
                        <>{i18next.t("prizeDropStartedMessage")}</>
                    </div>
                    <ul style={{alignItems: "left", textAlign: "left", marginLeft: -20}}>
                        {prizesToShow.map((prize: any, index: number) => (
                            <li key={"prize" + index}>
                                <>{i18next.t("prizeDropStartedPrizesLeftMessage", {amountLeft: campaignState.amountsLeft[index], totalAmount: prize.amount}) + ": "}</>
                                <b>
                                    {renderByPrizeType(
                                        prize,
                                        () => connector.formatCurrency(playerState.exchangedCashValues[index]),
                                        () => prize.value + "x " + i18next.t("bet").toLowerCase() + (prize.limit ? ` (${i18next.t("prizeDropCappedAt")} ${connector.formatCurrency(playerState.exchangedLimits[index])})` : ""),
                                        () => getItemDisplayValue(prize, connector.settings.language),
                                    )}
                                </b>
                            </li>
                        ))}
                        {prizesNotShownLeft > 0 ? (
                            <li key={"more"}>
                                <i>
                                    <>{i18next.t("prizeDropStartedAndMoreMessage")}</>
                                </i>
                            </li>
                        ) : (
                            <></>
                        )}
                    </ul>
                    {minimalQualifyingBet ? (
                        <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                            <>
                                {i18next.t("prizeDropStartedQualifyingBetMessage")}
                                <b>{connector.formatCurrency(minimalQualifyingBet)}</b>
                            </>
                        </div>
                    ) : (
                        <></>
                    )}
                    {campaign.end ? (
                        <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                            <>
                                {i18next.t("prizeDropStartedEndDateMessage")}
                                <b>{new Date(campaign.end).toLocaleString()}</b>
                            </>
                        </div>
                    ) : (
                        <></>
                    )}
                    <div style={{marginTop: 10}}>
                        <Button style={{textDecoration: "underline dotted"}} onClick={async () => this.showRulesPopup(connector, campaign, config, campaignState, playerState)}>
                            <>{i18next.t("prizeDropStartedTermsAndConditionsMessage")}</>
                        </Button>
                    </div>
                </>
            </div>
        );
    }

    private updateActiveCampaignHeader(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any) {
        const totalAmountLeft = campaignState.amountsLeft.reduce((sum: number, amount: number) => sum + amount, 0);
        const totalAmount = config.prizes.reduce((sum: number, prize: any) => sum + prize.amount, 0);
        const minQualifyingBet = findMinimalQualifyingBet(connector.bets, playerState);
        const isInactive = this.activeBet !== undefined && minQualifyingBet !== undefined && this.activeBet < playerState.exchangedQualifyingBet;

        connector.ui().addPromoHeader(
            "prizeDrop",
            PrizeDropHeaderIcon,
            `${totalAmountLeft}/${totalAmount}`,
            i18next.t("prizeDropHeaderCounter"),
            () => this.showRulesPopup(connector, campaign, config, campaignState, playerState),
            isInactive && (
                <p>
                    {i18next.t("prizeDropRulesQualifyingBetMessage") + " "} <b>{connector.formatCurrency(minQualifyingBet)}</b>
                </p>
            ),
        );

        this.activeCampaignInfo = {left: totalAmountLeft, total: totalAmount};
    }

    public async showPrizeWonPopup(connector: Connector, prizeWon: any, resolve: (value: void) => void) {
        connector.ui().showPopup({
            title: i18next.t("prizeDropWinTitle"),
            message: (
                <div style={{marginTop: -10, overflowX: "hidden", overflowY: "auto"}}>
                    <>
                        <PrizeDropIcon fill={connector.ui().getTheme().global!.colors!["background-back"] as string} stroke={connector.ui().getTheme().global!.colors!["control"] as string} />
                        <div style={{marginTop: 20}}>
                            <>{i18next.t("prizeDropWinMessage")}</>
                        </div>
                        <div style={{alignItems: "center", textAlign: "center", marginTop: 20}}>
                            {renderByPrizeType(
                                prizeWon,
                                () => (
                                    <b>{connector.formatCurrency(prizeWon.exchangedCashValue)}</b>
                                ),
                                () => (
                                    <>
                                        <b>{connector.formatCurrency(prizeWon.exchangedCashValue)}</b>{" "}
                                        {" (" + prizeWon.value + "x " + i18next.t("bet").toLowerCase() + (prizeWon.exchangedLimit ? ` - ${i18next.t("prizeDropCappedAt")} ${connector.formatCurrency(prizeWon.exchangedLimit)}` : "") + ")"}
                                    </>
                                ),
                                () => (
                                    <b>{getItemDisplayValue(prizeWon, connector.settings.language)}</b>
                                ),
                            )}
                        </div>
                    </>
                </div>
            ),
            buttons: [
                {
                    label: i18next.t("prizeDropWinAcknowledgeButton"),
                    secondary: true,
                    callback: async () => {
                        resolve();
                        if (connector.callbacks?.balanceChanged) {
                            const {balance} = await connector.balance();
                            connector.callbacks.balanceChanged(balance);
                        }
                    },
                },
            ],
        });
    }

    private showFinishedCampaignPopup(connector: Connector, campaignId: string, resolve: (value: void) => void) {
        connector.ui().showPopup({
            title: i18next.t("prizeDropFinishedTitle"),
            message: (
                <div style={{marginTop: -20, overflowX: "hidden", overflowY: "auto"}}>
                    <>
                        <PrizeDropIcon fill={connector.ui().getTheme().global!.colors!["background-back"] as string} stroke={connector.ui().getTheme().global!.colors!["control"] as string} />
                        {i18next.t("prizeDropFinishedMessage")}
                    </>
                </div>
            ),
            buttons: [
                {
                    label: i18next.t("prizeDropFinishedAcknowledgeButton"),
                    secondary: true,
                    callback: async () => {
                        await connector.acknowledgeCampaign(campaignId);
                        connector.ui().removePromoHeader("prizeDrop");
                        this.activeCampaignId = null;
                        resolve();
                    },
                },
            ],
        });
    }

    public async showRulesPopup(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any) {
        const prizesToShow = config.prizes;
        const minimalQualifyingBet = findMinimalQualifyingBet(connector.bets, playerState);

        const control = connector.ui().getTheme().global!.colors!["control"];
        const focus = connector.ui().getTheme().global!.colors!["focus"];
        const back = connector.ui().getTheme().global!.colors!["background-back"];
        const customTheme = {
            tab: {
                color: focus,
                border: {
                    side: "bottom",
                    color: back,
                    active: {
                        color: control,
                    },
                    hover: {
                        color: focus,
                    },
                },
                active: {
                    color: control,
                },
                hover: {
                    color: focus,
                },
            },
        };

        connector.ui().showPopup({
            title: i18next.t("prizeDropRulesTitle"),
            message: (
                <div style={{marginTop: -35, overflowX: "hidden", overflowY: "auto", maxHeight: "800px"}}>
                    <Grommet theme={customTheme}>
                        <Tabs flex={true}>
                            <Tab title={i18next.t("prizeDropRulesPrizesTab") as string}>
                                <div style={{marginTop: 20}}>
                                    <>
                                        <div style={{alignItems: "left", textAlign: "left"}}>
                                            <>{i18next.t("prizeDropRulesPrizesMessage")}</>
                                        </div>
                                        <ul style={{alignItems: "left", textAlign: "left", marginLeft: -20}}>
                                            {prizesToShow.map((prize: any, index: number) => (
                                                <li key={"prize" + index}>
                                                    <>{i18next.t("prizeDropStartedPrizesLeftMessage", {amountLeft: campaignState.amountsLeft[index], totalAmount: prize.amount}) + ": "}</>
                                                    <b>
                                                        {renderByPrizeType(
                                                            prize,
                                                            () => connector.formatCurrency(playerState.exchangedCashValues[index]),
                                                            () =>
                                                                prize.value +
                                                                "x " +
                                                                i18next.t("bet").toLowerCase() +
                                                                (prize.limit ? ` (${i18next.t("prizeDropCappedAt")} ${connector.formatCurrency(playerState.exchangedLimits[index])})` : ""),
                                                            () => getItemDisplayValue(prize, connector.settings.language),
                                                        )}
                                                    </b>
                                                </li>
                                            ))}
                                        </ul>
                                        {minimalQualifyingBet ? (
                                            <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                                                <>
                                                    {i18next.t("prizeDropRulesQualifyingBetMessage")}
                                                    <b>{connector.formatCurrency(minimalQualifyingBet)}</b>
                                                </>
                                            </div>
                                        ) : (
                                            <></>
                                        )}
                                        {campaign.end ? (
                                            <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                                                <>
                                                    {i18next.t("prizeDropStartedEndDateMessage")}
                                                    <b>{new Date(campaign.end).toLocaleString()}</b>
                                                </>
                                            </div>
                                        ) : (
                                            <></>
                                        )}
                                    </>
                                </div>
                            </Tab>
                            <Tab title={i18next.t("prizeDropRulesRulesTab") as string}>
                                <div style={{marginTop: 20, alignItems: "left", textAlign: "left"}} dangerouslySetInnerHTML={{__html: i18next.t("prizeDropRulesOtherMessage")}} />
                            </Tab>
                        </Tabs>
                    </Grommet>
                </div>
            ),
            buttons: [
                {
                    label: i18next.t("prizeDropRulesCloseButton"),
                    secondary: true,
                    callback: () => {},
                },
            ],
        });
    }

    public getActiveCampaignId() {
        return this.activeCampaignId;
    }

    public getActiveCampaignInfo() {
        return this.activeCampaignInfo;
    }
}

function renderByPrizeType(prize: any, cashRenderer: () => any, multiplierRenderer: () => any, itemRenderer: () => any) {
    switch (prize.type) {
        case "cash":
            return cashRenderer();
        case "multiplier":
            return multiplierRenderer();
        case "item":
            return itemRenderer();
    }
}
