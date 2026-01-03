import {configure, getConfiguration, on, send} from "@rlx/feim";
import {Connector, IWager} from "../Connector";
import {IAuthenticatedMessageData, IBalanceMessageData, IBetChangedMessageData, IErrorMessageData, IRecoveredMessageData, IStoppedMessageData, IWagerMessageData} from "../AsyncEventEmitter";

let currentBalance: number | undefined = undefined;
const currentRound: {
    roundId?: string;
    wagers?: IWager[];
} = {};

export default function initRelaxMessageBridge(connector: Connector) {
    registerGameEvents(connector);

    registerFeimEvents(connector);

    configure({
        handleRgPostMessageAPI: true,
        handleFeaturePause: false,
    });

    send.gameLoadStarted();
    send.updateSettings({sounds: true});
}

function registerGameEvents(connector: Connector) {
    connector.emitter.on("gameLoaded", ({progress}) => gameLoaded(progress));
    connector.emitter.on("authenticated", (data: IAuthenticatedMessageData) => authenticated(data.balance, data.currency));

    connector.emitter.on("balance", (data: IBalanceMessageData) => balance(data));
    connector.emitter.on("recovered", data => recovered(data));
    connector.emitter.on("wager", data => wager(data));
    connector.emitter.on("stopped", data => stopped(data));
    connector.emitter.on("betChanged", (data: IBetChangedMessageData) => betChanged(data.bet));
    connector.emitter.on("muted", () => muted());
    connector.emitter.on("unmuted", () => unmuted());
}

function registerFeimEvents(connector: Connector) {
    on.initialized(async () => {
        const configuration = getConfiguration();

        if (configuration.operatorHandlesGameExit) {
            connector.settings.customExit = "true";
            connector.emitter.on("exit", () => exit());
        }

        if (configuration.operatorHandlesErrors) {
            connector.settings.customErrorPopups = "true";
            connector.emitter.on("error", (errorMessageData: IErrorMessageData) => {
                let remotePopupShown;

                switch (errorMessageData.code) {
                    case "INSUFFICIENT_FUNDS": {
                        remotePopupShown = send.errorMessage({errorCode: 506}); // relax code for "Not enough funds for chosen bet size"
                        break;
                    }
                    case "LOSS_LIMIT": {
                        remotePopupShown = send.errorMessage({errorCode: 531}); // relax code for "Blocked from playing"
                        break;
                    }
                    default: {
                        if (errorMessageData.payload?.errorparameters) {
                            remotePopupShown = send.errorMessage(errorMessageData.payload.errorparameters);
                        }
                    }
                }

                if (!remotePopupShown) {
                    connector.showError(errorMessageData);
                }
            });
        }
    });

    on.freeze(() => connector.emitter.emit("freeze"));
    on.unfreeze(() => connector.emitter.emit("unfreeze"));
    on.pauseAutoPlay(() => connector.emitter.emit("stopAutoplay"));
    on.updateSettings(changedSettings => {
        if (changedSettings.sounds !== undefined) {
            connector.emitter.emit(changedSettings.sounds ? "unmute" : "mute").then(() => {});
        }
    });
}

function authenticated(balance: number, currency: string): void {
    configure({
        p2pConfig: {currency: currency.toUpperCase()},
    });

    send.balanceUpdate(Math.round(balance * 100));
}

function balance(messageData: IBalanceMessageData): void {
    currentBalance = messageData.balance;
}

function recovered(messageData: IRecoveredMessageData): void {
    currentRound.roundId = messageData.roundId;
    currentRound.wagers = messageData.wagers;

    if (currentBalance != undefined) {
        send.roundStarted({balance: Math.round(currentBalance * 100)});
    }
}

function wager(messageData: IWagerMessageData): void {
    if (currentRound.roundId === undefined || currentRound.roundId !== messageData.roundId) {
        currentRound.roundId = messageData.roundId;
        currentRound.wagers = [];
        send.roundStarted({balance: Math.round(messageData.balance * 100)});
    }

    currentRound.wagers!.push(messageData.wager);
}

function stopped(messageData: IStoppedMessageData): void {
    const roundFinishedData = {
        balance: Math.round(messageData.balance * 100),
        bet: Math.round(currentRound.wagers!.reduce((sum, wager) => sum + (wager.bet || 0), 0) * 100),
        win: {win: Math.round(currentRound.wagers!.reduce((sum, wager) => sum + (wager.win || 0), 0) * 100)},
    };
    send.roundFinished(roundFinishedData);
}

function exit(): void {
    send.exitGame();
}

function gameLoaded(progress: number): void {
    if (progress === 100) {
        send.gameLoadCompleted();
    }
}

function betChanged(bet: number): void {
    send.betUpdate(Math.round(bet * 100));
}

function muted(): void {
    send.updateSettings({sounds: false});
}

function unmuted(): void {
    send.updateSettings({sounds: true});
}
