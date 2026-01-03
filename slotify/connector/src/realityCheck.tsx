import i18next from "i18next";
import {Connector} from "./Connector";
import {Button} from "grommet";

const realityCheck = (connector: Connector, onOpen: () => void | undefined, onContinue: () => void, onGameHistory: () => void | undefined) => {
    const interval: number = connector.settings.realityCheckInterval ? Math.round(parseFloat(connector.settings.realityCheckInterval) * 60 * 1000) : 0;

    if (!interval) return;

    const elapsed: number = (connector.settings.realityCheckElapsed ? Math.round(parseFloat(connector.settings.realityCheckElapsed) * 60 * 1000) : 0) % interval;

    let isPlaying = false;
    let showRealityCheckOnComplete = false;
    let totalDifference = 0;
    const startTime = new Date().getTime();

    const showRealityCheck = () => {
        onOpen && onOpen();
        connector.callbacks?.stopAutoplay && connector.callbacks.stopAutoplay();

        const message = totalDifference >= 0 ? "realityCheckMessageWin" : "realityCheckMessageLose";
        const amount = connector.formatCurrency(Math.abs(totalDifference));
        const time = Math.round((new Date().getTime() - startTime) / 1000 / 60);
        connector.ui().showPopup({
            // title: i18next.t("realityCheckTitle"),
            message: (
                <>
                    {i18next.t(message, {amount, time})}
                    {onGameHistory && <Button label={i18next.t("gameHistory")} secondary style={{clear: "both", margin: "auto", marginTop: 10}} onClick={() => onGameHistory()} />}
                </>
            ),
            buttons: [
                {
                    label: i18next.t("continue"),
                    primary: true,
                    callback: () => {
                        if (connector.settings.realityCheckContinueUrl) {
                            const rcContinueReadyCallback = () => {
                                connector.emitter.off("realityCheckContinueReady", rcContinueReadyCallback);
                                onContinue && onContinue();
                                startInterval(interval);
                            };
                            connector.emitter.on("realityCheckContinueReady", rcContinueReadyCallback);
                            connector.emitter.emit("realityCheckContinuePressed");
                        } else {
                            onContinue && onContinue();
                            startInterval(interval);
                        }
                    },
                },
                {label: i18next.t("stop"), primary: true, callback: () => connector.exit(true)},
            ],
        });
    };

    const startInterval = (ms: number) => {
        setTimeout(() => {
            if (isPlaying) {
                showRealityCheckOnComplete = true;
            } else {
                showRealityCheck();
            }
        }, ms);
    };

    connector.emitter.on("started", () => {
        isPlaying = true;
    });
    connector.emitter.on("stopped", () => {
        isPlaying = false;
        if (showRealityCheckOnComplete) {
            showRealityCheckOnComplete = false;
            showRealityCheck();
        }
    });
    connector.emitter.on("wager", data => {
        totalDifference -= data.wager.bet || 0;
        totalDifference += data.wager.win || 0;
    });

    startInterval(interval - elapsed);
};

export default realityCheck;
