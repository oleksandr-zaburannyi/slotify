import {Connector} from "../Connector";
import {openURL} from "../util/url";

const w2gMappings: Record<string, (connector: Connector, data: any) => void> = {
    "ucip.basic.w2gInitializationResponse": initializeResponseHandler,
    "ucip.autoplay.w2gInterruptGameplayCommand": interruptGameplayHandler,
    "ucip.pause.w2gPauseCommand": gamePauseHandler,
    "ucip.displaystatus.w2gVisibilityChangeNotification": visibilityChangeHandler,
    "ucip.sound.w2gSoundUpdateNotification": soundUpdateHandler,
    "ucip.balancerefresh.w2gRefreshBalanceCommand": refreshBalanceHandler,
};

let isInitialized = false;
let isPlaying = false;
let isFreeze = false;
let lastWin = 0;
let sendOpenPage: Record<"deposit" | "game_history", boolean> = {deposit: false, game_history: false};
let closeGameHistoryHandler: (() => void) | null = null;

export default function initPlaytechMessageBridge(connector: Connector) {
    connector.settings.customExit = "true";
    connector.settings.customDeposit = "true";
    connector.settings.customHistory = "true";

    window.onmessage = function (e) {
        try {
            const jsonObj = JSON.parse(e.data);
            if (jsonObj._type && w2gMappings[jsonObj._type]) {
                w2gMappings[jsonObj._type](connector, jsonObj);
            }
        } catch {
            // couldn't parse json
        }
    };

    connector.emitter.on("started", started);
    connector.emitter.on("wager", wager);
    connector.emitter.on("stopped", stopped);
    connector.emitter.on("autoplayToggled", ({value}) => autoplayToggled(value));
    connector.emitter.on("muted", () => mute(true));
    connector.emitter.on("unmuted", () => mute(false));
    connector.emitter.on("exit", closeGameHandler);
    connector.emitter.on("deposit", () => openPageHandler({pageID: "deposit", url: connector.settings.depositUrl!}));
    connector.emitter.on("history", ({close}) => {
        closeGameHistoryHandler = close;
        openPageHandler({pageID: "game_history", url: connector.settings.historyUrl!})
    });

    const urlParams = new URLSearchParams(window.location.search);
    const integration = urlParams.get("integration");

    if (integration === "ucip") {
        isInitialized = true;
        sendPostMessage({
            _type: "ucip.basic.g2wInitializationRequest",
            version: "1.0.0",
            features: ["pause", "autoplay", "sound", "balanceupdate", "openpage"],
        });
    }
}

const sendPauseNotification = (pause: boolean) => sendPostMessage({_type: "ucip.pause.g2wPauseNotification", pause});
const sendBalanceNotification = (value: number, winAmount: number) => sendPostMessage({_type: "ucip.balanceupdate.g2wBalanceUpdateNotification", balance: {value, winAmount}});
const sendAutoplayStartNotification = () => sendPostMessage({_type: "ucip.autoplay.g2wAutoplayStartNotification"});
const sendAutoplayEndNotification = () => sendPostMessage({_type: "ucip.autoplay.g2wAutoplayEndNotification"});
const sendSoundNotification = (mute: boolean, level: number) => sendPostMessage({_type: "ucip.sound.g2wSoundUpdateNotification", mute, level});
const sendCloseGameFrameCommand = () => sendPostMessage({_type: "ucip.basic.g2wCloseGameFrameCommand"});
const sendOpenPageCommand = (pageID: string, url: string) => sendPostMessage({_type: "ucip.openpage.g2wOpenPageCommand", pageID, url});

function started() {
    isPlaying = true;
}

function wager({balance, wager}: any) {
    lastWin = wager.win;
    sendBalanceNotification(balance, 0);
}

function stopped({balance, finalWin}: any) {
    isPlaying = false;
    sendBalanceNotification(balance, finalWin ?? lastWin);
}

function autoplayToggled(value: boolean) {
    if (value) {
        sendAutoplayStartNotification();
    } else {
        sendAutoplayEndNotification();
    }
}

function mute(value: boolean) {
    sendSoundNotification(value, 100);
}

function sendPostMessage(request: any) {
    if (!isInitialized) {
        return;
    }
    window.parent.postMessage(JSON.stringify(request), "*");
}

function gamePauseHandler(connector: Connector, data: {pause: true}) {
    if (data.pause) {
        if (isPlaying) {
            const onStopped = () => {
                connector.emitter.off("stopped", onStopped);
                connector.ui().showOverlay();
                connector.callbacks?.freeze?.();
                isFreeze = true;
                sendPauseNotification(true);
            };
            connector.emitter.on("stopped", onStopped);
        } else {
            connector.ui().showOverlay();
            sendPauseNotification(true);
        }
    } else {
        connector.ui().hideOverlay();
        if (isFreeze) {
            connector.callbacks?.unfreeze?.();
            isFreeze = false;
        }
        sendPauseNotification(false);
    }
}

function interruptGameplayHandler(connector: Connector) {
    connector.callbacks?.stopAutoplay?.();
}

function initializeResponseHandler(connector: Connector, data: {features: any[]}) {
    for (const feature of data.features) {
        if (Array.isArray(feature) && feature[0] === "sound") {
            const {mute, level} = feature[1];
            soundUpdateHandler(connector, {mute, level});
        } else if (Array.isArray(feature) && feature[0] === "openpage") {
            sendOpenPage = {deposit: feature[1].delegatePages.includes("deposit"), game_history: feature[1].delegatePages.includes("game_history")};
        } else if (feature === "openpage") {
            sendOpenPage = {deposit: true, game_history: true};
        }
    }
}

function visibilityChangeHandler(connector: Connector, data: {visible: boolean}) {
    if (!data.visible) {
        if (isPlaying) {
            const onStopped = () => {
                connector.emitter.off("stopped", onStopped);
                connector.ui().showOverlay();
                connector.callbacks?.freeze?.();
                isFreeze = true;
            };
            connector.emitter.on("stopped", onStopped);
        } else {
            connector.ui().showOverlay();
        }
    } else {
        connector.ui().hideOverlay();
        if (closeGameHistoryHandler) {
            closeGameHistoryHandler();
            closeGameHistoryHandler = null;
        }
        if (isFreeze) {
            connector.callbacks?.unfreeze?.();
            isFreeze = false;
        }
    }
}

function soundUpdateHandler(connector: Connector, data: {mute: boolean; level: number}) {
    if (data.mute || data.level === 0) {
        connector.callbacks?.mute?.();
    } else {
        connector.callbacks?.unmute?.();
    }
}

function refreshBalanceHandler(connector: Connector) {
    connector.emitter.emit("refreshBalance");
}

function closeGameHandler() {
    sendCloseGameFrameCommand();
}

function openPageHandler(data: {pageID: "deposit" | "game_history"; url: string}) {
    if (sendOpenPage[data.pageID]) {
        sendOpenPageCommand(data.pageID, data.url);
    } else {
        openURL(data.url, "_blank");
    }
}
