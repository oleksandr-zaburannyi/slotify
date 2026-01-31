import {Campaign, Connector} from "../Connector";
import i18next from "i18next";
import {IBetChangedMessageData} from "../AsyncEventEmitter";
import {IPromoToolUi, ITournamentCampaignInfo} from "./IPromoToolUi";
import {Box, Button, Grommet, ResponsiveContext, Tab, Table, TableBody, TableCell, TableHeader, TableRow, Tabs} from "grommet";
import {CaretRightFill, CirclePlay} from "grommet-icons";
import TournamentIcon from "./icon/TournamentIcon";
import {findMinimalQualifyingBet} from "../util/findMinimalQualifyingBet";
import TournamentHeaderIcon from "./icon/TournamentHeaderIcon";
import {getItemDisplayValue} from "../util/getItemDisplayValue";

export class TournamentUi implements IPromoToolUi {
    private activeBet?: number;
    private activeCampaignId: string | null = null;
    private activeCampaignInfo: ITournamentCampaignInfo | null = null;

    public async init(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, campaignState, playerState} = await connector.getCampaign(campaign.campaignId, true);

        if (campaign.status === "started") {
            return new Promise(resolve => {
                this.showStartedCampaignPopup(connector, campaign, config, campaignState, playerState, resolve);
            });
        } else if (campaign.status === "finished") {
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);

            await this.showFinishedCampaignPopup(connector, campaign, config, campaignState, playerState);
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

        await this.showFinishedCampaignPopup(connector, campaign, config, campaignState, playerState);
        return {shouldIgnore: false, shouldRefresh: true};
    }

    public async onWager(): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        return {shouldIgnore: false, shouldRefresh: false};
    }

    public async onStopped(connector: Connector, campaign: Campaign): Promise<{shouldIgnore: boolean; shouldRefresh: boolean}> {
        const {config, campaignState, playerState} = await connector.getCampaign(campaign.campaignId);

        if (campaign.status === "started") {
            return new Promise(resolve => {
                this.showStartedCampaignPopup(connector, campaign, config, campaignState, playerState, resolve);
            });
        }

        if (campaign.status === "active" || campaign.status === "finished") {
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);
        }

        if (campaign.status === "finished") {
            this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);
            await this.showFinishedCampaignPopup(connector, campaign, config, campaignState, playerState);
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
            title: i18next.t("tournamentStartedTitle"),
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
                const {config, campaignState, playerState} = await connector.getCampaign(campaign.campaignId);
                this.updateActiveCampaignHeader(connector, campaign, config, campaignState, playerState);
                this.activeCampaignId = campaign.campaignId;
                resolve({shouldIgnore: false, shouldRefresh: false});
            },
        };
        const buttons = connector.settings.hidePromoOptOut === "true" ? [playButton] : [optOutButton, playButton];

        connector.ui().showPopup({
            title: i18next.t("tournamentStartedTitle"),
            message: this.getPopupContent(connector, campaign, config, campaignState, playerState),
            buttons,
        });
    }

    private getPopupContent(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any) {
        const prizesToShow = config.prizes.slice(0, 3);
        const prizesNotShownLeft = config.prizes.length - prizesToShow.length;

        const minimalQualifyingBet = findMinimalQualifyingBet(connector.bets, playerState);

        return (
            <div style={{marginTop: -35, overflowX: "hidden", overflowY: "auto"}}>
                <>
                    <TournamentIcon fill={connector.ui().getTheme().global!.colors!["background-back"] as string} stroke={connector.ui().getTheme().global!.colors!["control"] as string} />
                    <div style={{marginTop: 10}}>
                        <>{i18next.t("tournamentStartedMessage")}</>
                    </div>
                    <ul style={{alignItems: "left", textAlign: "left", marginLeft: -20}}>
                        {prizesToShow.map((prize: any, index: number) => {
                            return (
                                prize.value && (
                                    <li key={"prize" + index}>
                                        <>{i18next.t("tournamentStartedPrizesMessage", {totalAmount: prize.amount}) + " "}</>
                                        <b>{prize.type === "cash" ? connector.formatCurrency(playerState.exchangedCashValues[index]) : getItemDisplayValue(prize, connector.settings.language)}</b>
                                    </li>
                                )
                            );
                        })}
                        {prizesNotShownLeft > 0 ? (
                            <li key={"more"}>
                                <i>
                                    <>{i18next.t("tournamentStartedAndMoreMessage")}</>
                                </i>
                            </li>
                        ) : (
                            <></>
                        )}
                    </ul>
                    {minimalQualifyingBet ? (
                        <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                            <>
                                {i18next.t("tournamentStartedQualifyingBetMessage")}
                                <b>{connector.formatCurrency(minimalQualifyingBet)}</b>
                            </>
                        </div>
                    ) : (
                        <></>
                    )}
                    {campaign.end ? (
                        <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                            <>
                                {i18next.t("tournamentStartedEndDateMessage")}
                                <b>{new Date(campaign.end).toLocaleString()}</b>
                            </>
                        </div>
                    ) : (
                        <></>
                    )}
                    <div style={{marginTop: 10}}>
                        <Button style={{textDecoration: "underline dotted"}} onClick={async () => this.showRulesPopup(connector, campaign, config, campaignState, playerState)}>
                            <>{i18next.t("tournamentStartedTermsAndConditionsMessage")}</>
                        </Button>
                    </div>
                </>
            </div>
        );
    }

    private updateActiveCampaignHeader(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any) {
        const minQualifyingBet = findMinimalQualifyingBet(connector.bets, playerState);
        const isInactive = this.activeBet !== undefined && minQualifyingBet !== undefined && this.activeBet < playerState.exchangedQualifyingBet;

        const playerRank =
            playerState.leaderboardRoundId != null && campaignState.leaderboard.roundIds.some((roundId: string) => roundId === playerState.leaderboardRoundId)
                ? campaignState.leaderboard.roundIds.findIndex((roundId: string) => roundId === playerState.leaderboardRoundId) + 1
                : "-";
        const totalPositions = Object.keys(campaignState.leaderboard.roundIds).length;

        connector.ui().addPromoHeader(
            "tournament",
            TournamentHeaderIcon,
            `${playerRank}/${totalPositions}`,
            i18next.t("tournamentHeaderRank"),
            () => this.showRulesPopup(connector, campaign, config, campaignState, playerState),
            isInactive && (
                <p>
                    {i18next.t("tournamentRulesQualifyingBetMessage") + " "}
                    <b>{connector.formatCurrency(minQualifyingBet)}</b>
                </p>
            ),
        );

        this.activeCampaignInfo = {playerRank, totalPositions};
    }

    private async showFinishedCampaignPopup(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any): Promise<void> {
        const position = playerState.leaderboardRoundId != null ? campaignState.leaderboard.roundIds.findIndex((roundId: string) => roundId === playerState.leaderboardRoundId) + 1 : -1;

        const prizeIndex = this.getPrizeIndex(config.prizes, position - 1);
        const prize = config.prizes[prizeIndex];
        const exchangedPrizeValue = playerState.exchangedCashValues[prizeIndex];

        return new Promise(resolve =>
            connector.ui().showPopup({
                title: i18next.t("tournamentFinishedTitle"),
                message: (
                    <div style={{marginTop: -30, overflowX: "hidden", overflowY: "auto"}}>
                        <TournamentIcon fill={connector.ui().getTheme().global!.colors!["background-back"] as string} stroke={connector.ui().getTheme().global!.colors!["control"] as string} />
                        <div style={{marginTop: 10}}>
                            <>
                                {i18next.t("tournamentFinishedIntroMessage")} <br />
                                {position > 0 && (
                                    <>
                                        {i18next.t("tournamentFinishedPositionMessage", {position})} <br />
                                        {prize.value && (
                                            <>
                                                {i18next.t("tournamentFinishedPrizeMessage") + " "}
                                                <b>{prize.type === "cash" ? connector.formatCurrency(exchangedPrizeValue) : getItemDisplayValue(prize, connector.settings.language)}</b>!
                                            </>
                                        )}
                                        <br />
                                    </>
                                )}
                                {position > 0 ? i18next.t("tournamentFinishedCongratulationsMessage") : i18next.t("tournamentFinishedOutroMessage")}
                            </>
                        </div>
                    </div>
                ),
                buttons: [
                    {
                        label: i18next.t("tournamentFinishedAcknowledgeButton"),
                        secondary: true,
                        callback: async () => {
                            await connector.acknowledgeCampaign(campaign.campaignId);
                            connector.ui().removePromoHeader("tournament");
                            this.activeCampaignId = null;
                            resolve();
                            if (connector.callbacks?.balanceChanged) {
                                const {balance} = await connector.balance();
                                connector.callbacks.balanceChanged(balance);
                            }
                        },
                    },
                ],
            }),
        );
    }

    public async showRulesPopup(connector: Connector, campaign: Campaign, config: any, campaignState: any, playerState: any) {
        const prizeValuesAtPositions = config.prizes.flatMap((prize: any, index: number) => Array(prize.amount).fill(prize.type === "cash" ? connector.formatCurrency(playerState.exchangedCashValues[index]) : getItemDisplayValue(prize, connector.settings.language)));

        const urls = campaignState.leaderboard.roundIds.map((roundId: string, index: number) => (campaignState.leaderboard.games[index] != null ? connector.getReplayUrl(roundId, campaignState.leaderboard.games[index]) : null));

        const playerIndexToHighlight = playerState.leaderboardRoundId != null ? campaignState.leaderboard.roundIds.findIndex((roundId: string) => roundId === playerState.leaderboardRoundId) : -1;

        const startPlaces = [0];
        for (let prizeIndex = 1; prizeIndex < config.prizes.length; prizeIndex++) {
            startPlaces.push(startPlaces[prizeIndex - 1] + config.prizes[prizeIndex - 1].amount);
        }

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
            title: i18next.t("tournamentRulesTitle"),
            message: (
                <ResponsiveContext.Consumer>
                    {size => {
                        const isMobile = size === "xsmall" || size === "small";
                        return (
                            <div style={{overflowX: "hidden", overflowY: "auto", maxHeight: "800px", ...(isMobile ? {margin: "-35px -20px 0px"} : {marginTop: "-35px"})}}>
                                <Grommet theme={customTheme}>
                                    <Tabs flex={true}>
                                        <Tab title={i18next.t("tournamentRulesPrizesTab") as string}>
                                            <div style={{textAlign: "left", marginTop: "20px", marginInline: isMobile ? "20px" : 0}}>
                                                <>{i18next.t("tournamentRulesPrizesIntroMessage")}</>
                                                <ul style={{marginLeft: -20}}>
                                                    {config.prizes.map((prize: any, index: number) => {
                                                        return (
                                                            prize.value && (
                                                                <li key={"prize" + index}>
                                                                    {prize.amount === 1 ? (
                                                                        <>{i18next.t("tournamentRulesPositionMessage", {position: startPlaces[index] + 1}) + " "}</>
                                                                    ) : (
                                                                        <>{i18next.t("tournamentRulesPositionsMessage", {from: startPlaces[index] + 1, to: startPlaces[index] + prize.amount}) + " "}</>
                                                                    )}
                                                                    <b>{prize.type === "cash" ? connector.formatCurrency(playerState.exchangedCashValues[index]) : getItemDisplayValue(prize, connector.settings.language)}</b>
                                                                </li>
                                                            )
                                                        );
                                                    })}
                                                </ul>
                                                {minimalQualifyingBet ? (
                                                    <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                                                        <>
                                                            {i18next.t("tournamentRulesQualifyingBetMessage")}
                                                            <b>{connector.formatCurrency(minimalQualifyingBet)}</b>
                                                        </>
                                                    </div>
                                                ) : (
                                                    <></>
                                                )}
                                                {config.baseBetOnly ? (
                                                    <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                                                        <>{i18next.t("tournamentRulesBetTypeMessage")}</>
                                                    </div>
                                                ) : (
                                                    <></>
                                                )}
                                                {campaign.end ? (
                                                    <div style={{alignItems: "left", textAlign: "left", marginTop: 10}}>
                                                        <>
                                                            {i18next.t("tournamentStartedEndDateMessage")}
                                                            <b>{new Date(campaign.end).toLocaleString()}</b>
                                                        </>
                                                    </div>
                                                ) : (
                                                    <></>
                                                )}
                                            </div>
                                        </Tab>
                                        <Tab title={i18next.t("tournamentRulesLeaderboardTab") as string}>
                                            <div style={{marginTop: "20px", overflowY: "auto"}}>
                                                <Table style={{height: "100%", width: "100%", alignContent: "center", alignItems: "center", textAlign: "center", ...(isMobile ? {tableLayout: "fixed", fontSize: "16px"} : {})}}>
                                                    <TableHeader>
                                                        <TableRow key={"row"}>
                                                            <TableCell style={{textAlign: "center", ...(isMobile ? {paddingLeft: "20px"} : {})}} {...(isMobile ? {pad: "6px", size: "54px"} : {})} scope="col" border="bottom">
                                                                {isMobile ? "#" : i18next.t("tournamentLeaderboardPosition")}
                                                            </TableCell>
                                                            <TableCell style={{textAlign: "center"}} {...(isMobile ? {pad: "6px"} : {})} scope="col" border="bottom">
                                                                {i18next.t("tournamentLeaderboardWinRatio")}
                                                            </TableCell>
                                                            <TableCell style={{textAlign: "center"}} {...(isMobile ? {pad: "6px"} : {})} scope="col" border="bottom">
                                                                {i18next.t("tournamentLeaderboardPrize")}
                                                            </TableCell>
                                                            <TableCell style={{textAlign: "center"}} {...(isMobile ? {pad: "6px"} : {})} scope="col" border="bottom">
                                                                {i18next.t("tournamentLeaderboardReplay")}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {campaignState.leaderboard.winRatios.map((winRatio: number, index: number) => (
                                                            <TableRow
                                                                key={"row" + index}
                                                                style={
                                                                    index === playerIndexToHighlight
                                                                        ? {
                                                                              backgroundColor: connector.ui().getTheme().global!.colors!["background-back"] as string,
                                                                          }
                                                                        : {}
                                                                }
                                                            >
                                                                <TableCell style={{textAlign: "center"}}>
                                                                    <Box direction={"row"}>
                                                                        <CaretRightFill
                                                                            style={{visibility: index === playerIndexToHighlight ? "visible" : "hidden", ...(isMobile ? {width: "20px"} : {})}}
                                                                            color={connector.ui().getTheme().global!.colors!.control as string}
                                                                        />
                                                                        {index + 1}.
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell style={{textAlign: "center"}}>{winRatio != null ? Number(winRatio.toFixed(2)) + "x" : "-"}</TableCell>
                                                                <TableCell style={{textAlign: "center"}}>{prizeValuesAtPositions[index]}</TableCell>
                                                                <TableCell style={{alignItems: "center"}}>
                                                                    {urls[index] && (
                                                                        <a href={urls[index]} target="_blank" rel="noopener noreferrer">
                                                                            <CirclePlay color={connector.ui().getTheme().global!.colors!.control as string} />
                                                                        </a>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </Tab>
                                        <Tab title={i18next.t("tournamentRulesRulesTab") as string}>
                                            <div style={{marginTop: 20, marginInline: isMobile ? "20px" : 0, alignItems: "left", textAlign: "left"}} dangerouslySetInnerHTML={{__html: i18next.t("tournamentRulesOtherMessage")}} />
                                        </Tab>
                                    </Tabs>
                                </Grommet>
                            </div>
                        );
                    }}
                </ResponsiveContext.Consumer>
            ),
            buttons: [
                {
                    label: i18next.t("tournamentRulesCloseButton"),
                    secondary: true,
                    callback: () => {},
                },
            ],
        });
    }

    private getPrizeIndex(prizes: any[], leaderboardIndex: number): number {
        let index = 0;
        let prizesSum = prizes[0].amount;
        while (index < prizes.length && leaderboardIndex >= prizesSum) {
            index++;
            prizesSum += prizes[index].amount;
        }

        return index;
    }

    public getActiveCampaignId() {
        return this.activeCampaignId;
    }

    public getActiveCampaignInfo() {
        return this.activeCampaignInfo;
    }
}
