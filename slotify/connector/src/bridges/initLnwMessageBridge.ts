import i18next from "i18next";
import {IBalanceMessageData, IBetChangedMessageData, IErrorMessageData, IExitData, IGameLoadedMessageData, IRecoveredMessageData, IWagerMessageData} from "../AsyncEventEmitter";
import {Connector, IFeatures, IPopup, IWager} from "../Connector";
import {UiApi} from "../Ui";
import FreeBetsHeaderIcon from "../promo/icon/FreeBetsHeaderIcon";

let sendToGCM: (type: string, data?: any) => void;
const freeBetsSession = {
    isActive: false,
    remainingRounds: 0,
    totalRounds: 0,
    totalWin: 0,
};
const currentRound: {
    roundId?: string;
    wagers?: IWager[];
} = {};
const gameReadyRequirements = {
    balance: false,
    betChanged: false,
};

export default function initLnwMessageBridge(connector: Connector, ui: () => UiApi, features: IFeatures) {
    registerGameEvents(connector, ui);
    initGCMChannelMessagingAPI(registerGcmEvents(connector));

    sendToGCM("setGameConfig", {gameName: connector.settings.game ?? connector.settings.gameCode, gameLoadingScreen: true});

    if (features.mute) sendToGCM("regOption", {optionType: "MUTE"});
    if (features.turbo) sendToGCM("regOption", {optionType: "TURBO"});
    if (features.paytable) sendToGCM("regOption", {optionType: "PAYTABLE"});
    if (features.help) sendToGCM("regOption", {optionType: "HELP"});
    if (features.about) sendToGCM("regOption", {optionType: "ABOUT"});
}

function initGCMChannelMessagingAPI(fn: (e: MessageEvent<string>) => void) {
    const {port1, port2} = new MessageChannel();

    port1.onmessage = fn;
    sendToGCM = (type: string, data?: string) => {
        port1.postMessage(
            JSON.stringify({
                eventName: `com.lnw.gcm.${type}`,
                ...(data ? {eventData: data} : undefined),
            }),
        );
    };

    window.parent.postMessage(JSON.stringify({eventName: "com.lnw.gcm.initialiseChannel"}), "*", [port2]);
}

function registerGameEvents(connector: Connector, ui: () => UiApi) {
    connector.settings.customExit = "true";
    connector.settings.customReload = "true";
    connector.settings.customErrorPopups = "true";

    connector.emitter.on("gameLoaded", gameLoaded);
    connector.emitter.on("authenticated", gameReady);
    connector.emitter.on("recovered", recovered);

    connector.emitter.on("balance", balance);
    connector.emitter.on("wager", data => wager(data, connector, ui));
    connector.emitter.on("started", started);
    connector.emitter.on("stopped", stopped);
    connector.emitter.on("betChanged", betChanged);
    connector.emitter.on("muted", muted);
    connector.emitter.on("unmuted", unmuted);
    connector.emitter.on("turboToggled", ({value}) => turboToggled(value));
    connector.emitter.on("paytableToggled", ({value}) => paytableToggled(value));
    connector.emitter.on("helpToggled", ({value}) => helpToggled(value));
    connector.emitter.on("aboutToggled", ({value}) => aboutToggled(value));
    connector.emitter.on("autoplayToggled", ({value}) => autoplayToggled(value, connector));
    connector.emitter.on("reload", reload);
    connector.emitter.on("exit", exit);
    connector.emitter.on("realityCheckContinuePressed", () => rcContinue(connector));
    connector.emitter.on("messagePopup", handleMessagePopup);
    connector.emitter.on("error", handleError);
    connector.emitter.on("chosenPopupOption", ({data}) => chosenPopupOption(data, connector, ui));
}

function registerGcmEvents(connector: Connector) {
    return (e: MessageEvent<string>) => {
        const data = JSON.parse(e.data);
        const eventName = data.eventName.substring(data.eventName.lastIndexOf(".") + 1);
        switch (eventName) {
            case "resume":
                return connector.emitter.emit("unfreeze");
            case "balancesHasChanged":
                return connector.emitter.emit("balanceChanged", {balance: data.eventData.balances.CASH});
            case "stopAutoPlay":
                return connector.emitter.emit("stopAutoplay");
            case "optionHasChanged": {
                switch (data.eventData.option) {
                    case "MUTE":
                        return connector.emitter.emit(data.eventData.value ? "mute" : "unmute");
                    case "TURBO":
                        return connector.emitter.emit("turboToggle", {value: data.eventData.value});
                    case "PAYTABLE":
                        return connector.emitter.emit("paytableToggle", {value: data.eventData.value});
                    case "HELP":
                        return connector.emitter.emit("helpToggle", {value: data.eventData.value});
                    case "ABOUT":
                        return connector.emitter.emit("aboutToggle", {value: data.eventData.value});
                }
            }
        }
    };
}

function gameLoaded({progress}: IGameLoadedMessageData) {
    sendToGCM("loadProgressUpdate", {percent: progress});
}

function gameReady() {
    if (Object.values(gameReadyRequirements).every(Boolean)) {
        sendToGCM("gameReady");
    }
}

function recovered({roundId, wagers}: IRecoveredMessageData): void {
    currentRound.roundId = roundId;
    currentRound.wagers = wagers;
}

function balance({balance}: IBalanceMessageData) {
    sendToGCM("balancesUpdate", {
        balances: {CASH: balance, BONUS: 0},
    });

    if (!gameReadyRequirements.balance) {
        gameReadyRequirements.balance = true;
        gameReady();
    }
}

function wager({roundId, wager}: IWagerMessageData, connector: Connector, ui: () => UiApi) {
    if (roundId === undefined || currentRound.roundId !== roundId) {
        currentRound.roundId = roundId;
        currentRound.wagers = [];
    }
    currentRound.wagers!.push(wager);

    if (freeBetsSession.isActive) {
        freeBetsSession.totalWin += wager.win;
        freeBetsSession.remainingRounds--;
        updateFreeBetsUI(freeBetsSession, connector, ui);
    }
}

function betChanged({bet}: IBetChangedMessageData) {
    sendToGCM("stakeUpdate", {amount: bet});

    if (!gameReadyRequirements.betChanged) {
        gameReadyRequirements.betChanged = true;
        gameReady();
    }
}

function started() {
    sendToGCM("gameAnimationStart");
}

function stopped() {
    sendToGCM("gameAnimationComplete");
    sendToGCM("paidUpdate", {amount: currentRound.wagers!.reduce((sum, wager) => sum + (wager.win || 0), 0)});
}

function muted() {
    sendToGCM("optionHasChanged", {changedFrom: "GAME", optionType: "MUTE", newValue: true});
}

function unmuted() {
    sendToGCM("optionHasChanged", {changedFrom: "GAME", optionType: "MUTE", newValue: false});
}

function turboToggled(value: boolean) {
    sendToGCM("optionHasChanged", {changedFrom: "GAME", optionType: "TURBO", newValue: value});
}

function paytableToggled(value: boolean) {
    sendToGCM("optionHasChanged", {changedFrom: "GAME", optionType: "PAYTABLE", newValue: value});
}

function helpToggled(value: boolean) {
    sendToGCM("optionHasChanged", {changedFrom: "GAME", optionType: "HELP", newValue: value});
}

function aboutToggled(value: boolean) {
    sendToGCM("optionHasChanged", {changedFrom: "GAME", optionType: "ABOUT", newValue: value});
}

function reload() {
    sendToGCM("reload");
}

function exit({lobbyUrl}: IExitData) {
    sendToGCM("redirect", {url: lobbyUrl});
}

async function rcContinue(connector: Connector) {
    await fetch(connector.settings.realityCheckContinueUrl!);
    const unfreezeCallback = () => {
        connector.emitter.off("unfreeze", unfreezeCallback);
        connector.emitter.emit("realityCheckContinueReady");
    };
    connector.emitter.on("unfreeze", unfreezeCallback);
}

async function autoplayToggled(value: boolean, connector: Connector) {
    if (value) {
        await fetch(connector.settings.startAutoplayUrl!);
    }
}

function handleMessagePopup(popups: IPopup[]) {
    for (const popup of popups || []) {
        sendToGCM("handleMessageTrigger", {msgTriggerData: popup.message});
    }
}

function handleError(messageData: IErrorMessageData) {
    const title = messageData.popups?.[0].title as string;
    const isRcError = title?.startsWith("RC_ERROR:");
    if (!messageData.popups || isRcError) {
        if (isRcError) {
            const [, errorCode, category, severity] = title.split(":");
            sendToGCM("handleError", {category, severity, errorCode, message: messageData.popups![0].message});
        } else {
            const category = messageData.code === "INSUFFICIENT_FUNDS" ? messageData.code : "NON_RECOVERABLE_ERROR";
            sendToGCM("handleError", {category, severity: "ERROR", errorCode: messageData.code, message: messageData.message});
        }
    } else {
        handleMessagePopup(messageData.popups);
    }
}

function updateFreeBetsUI(data: typeof freeBetsSession, connector: Connector, ui: () => UiApi) {
    ui().addPromoHeader("freeBetsSession", FreeBetsHeaderIcon, `${data.remainingRounds}`, i18next.t("lnw_freeBetsTitle"), () => {
        ui().showPopup({
            title: i18next.t("lnw_freeBetsTitle"),
            message: i18next.t("lnw_freeBetsFinishedMessage", {spins: data.totalRounds - data.remainingRounds, win: connector.formatCurrency(data.totalWin)}),
            buttons: [
                {
                    label: i18next.t("continue"),
                    primary: true,
                    callback: async () => null,
                },
            ],
        });
    });
}

function chosenPopupOption(data: any, connector: Connector, ui: () => UiApi) {
    if (data.isFreeBetRoundStart === "true") {
        freeBetsSession.isActive = true;
        freeBetsSession.remainingRounds = data.remainingRounds;
        freeBetsSession.totalRounds = data.totalRounds;
        updateFreeBetsUI(freeBetsSession, connector, ui);
    }
    if (data.isFreeBetRoundEnd === "true") {
        ui().removePromoHeader("freeBetsSession");
        freeBetsSession.totalWin = 0;
        freeBetsSession.remainingRounds = 0;
        freeBetsSession.totalRounds = 0;
        freeBetsSession.isActive = false;
    }
}
