import {IPopup, IWager} from "./Connector";

type IOutgoingMessage =
    | "gameLoaded"
    | "authenticated"
    | "recovered"
    | "started"
    | "stopped"
    | "balance"
    | "wager"
    | "exit"
    | "reload"
    | "deposit"
    | "history"
    | "betChanged"
    | "replayShown"
    | "replayHidden"
    | "muted"
    | "unmuted"
    | "turboToggled"
    | "paytableToggled"
    | "helpToggled"
    | "aboutToggled"
    | "autoplayToggled"
    | "realityCheckContinuePressed"
    | "realityCheckContinueReady"
    | "messagePopup"
    | "error";
type IIncomingMessage = "freeze" | "unfreeze" | "mute" | "unmute" | "turboToggle" | "paytableToggle" | "helpToggle" | "aboutToggle" | "play" | "stopAutoplay" | "balanceChanged" | "refreshBalance" | "chosenPopupOption";
type ICallback = (data?: any) => Promise<void> | void;

export interface IGameLoadedMessageData {
    progress: number;
}

export interface IAuthenticatedMessageData {
    balance: number;
    token: string;
    currency: string;
    sessionData: any;
}

export interface IRecoveredMessageData {
    wagers: IWager[];
    roundId: string;
}

export interface IBalanceMessageData {
    balance: number;
}

export interface IWagerMessageData {
    wager: IWager;
    balance: number;
    roundId: string;
}

export interface IStoppedMessageData {
    roundId: string;
    balance: number;
}

export interface IBetChangedMessageData {
    bet: number;
}

export interface IErrorMessageData {
    code?: string;
    message?: string;
    popups?: IPopup[];
    payload?: any;
}

export interface IExitData {
    lobbyUrl: string;
}

export class AsyncEventEmitter {
    private callbacks: Record<string, ICallback[]> = {};

    constructor() {
        window.addEventListener("message", async e => {
            if (e.source === window.self) return;
            const {message, data}: {message: IIncomingMessage; data: any} = e.data;
            await this.emit(message, data, false);
        });
    }

    on(event: IOutgoingMessage | IIncomingMessage, callback: ICallback) {
        this.callbacks[event] ||= [];
        this.callbacks[event].push(callback);
    }

    off(event: IOutgoingMessage | IIncomingMessage, callback: ICallback) {
        this.callbacks[event].splice(this.callbacks[event].indexOf(callback), 1);
    }

    async emit(event: IOutgoingMessage | IIncomingMessage, data?: any, postMessage = true) {
        for (const callback of this.callbacks[event] || []) {
            await callback(data);
        }
        if (postMessage) {
            (window.parent || window).postMessage({message: event, data}, "*");
        }
    }
}
