import {FC, useEffect, useState} from "react";
import {Box, Button, ColumnConfig, DataTable, List, Spinner, Text} from "grommet";
import i18next from "i18next";
import realityCheck from "./realityCheck";
import {applySettings, ISettings} from "./settings";
import {v4} from "uuid";
import {PromoUIStyle, UiApi} from "./Ui";
import promoUi, {getPromoToolUis} from "./promo/promoUi";
import {IFreeBetsCampaignInfo, IPrizeDropCampaignInfo, ITournamentCampaignInfo} from "./promo/IPromoToolUi";
import {AsyncEventEmitter, IErrorMessageData} from "./AsyncEventEmitter";
import {sessionUi} from "./sessionUi";
import {translateKeys} from "./util/translations";
import {initFormatters} from "./locale";
import {validationFunctions} from "./util/popupValidators";
import defaultFormatCurrency from "./util/defaultFormatCurrency";
import {floor} from "@slotify/shared/lib/floor";
import {updatePromoIcons} from "./promo/icon/promoIcons";
import {xorDecrypt, xorEncrypt} from "@slotify/shared/lib/xorCipher";
import {ensureURL, openURL} from "./util/url";

export interface IFeatures {
    mute?: boolean;
    turbo?: boolean;
    paytable?: boolean;
    help?: boolean;
    about?: boolean;
}

export interface ICallbacks {
    mute?: () => void;
    unmute?: () => void;
    turboToggle?: (value: boolean) => void;
    paytableToggle?: (value: boolean) => void;
    helpToggle?: (value: boolean) => void;
    aboutToggle?: (value: boolean) => void;
    stopAutoplay?: () => void;
    play?: (action: string, bet: number) => void;
    freezeBet?: (bet: number) => void;
    unfreezeBet?: () => void;
    popupOpened?: (count: number) => void;
    popupClosed?: (count: number) => void;
    openGameHistory?: () => void;
    formatCurrency?: (value: number, currencySymbol?: string, language?: string, currencyDecimals?: number) => string;
    freeze?: () => void;
    unfreeze?: () => void;
    balanceChanged?: (balance: number) => void;
}

type IPopupButtonActions = "exit" | "close" | "url" | "history" | "walletMessage" | "freezeBet" | "unfreezeBet";
type IExceptionPopupTranslation = {
    key: string;
    data: Record<string, string>;
};

export interface IPopup {
    title?: string | IExceptionPopupTranslation;
    message: string | IExceptionPopupTranslation;
    options?: {label: string | IExceptionPopupTranslation; value: number; data?: any}[];
    buttons?: {label: string | IExceptionPopupTranslation; action: IPopupButtonActions; validationFn?: keyof typeof validationFunctions; data?: any; preventClose?: boolean}[];
    isCustomPopup?: boolean;
}

export type IBets = Record<
    string,
    {
        available: number[] | {min: number; max: number; step: number};
        default: number;
        coin: number;
    }
>;

type IPlayWager = Pick<IWager, "win" | "state" | "data" | "next"> & {feed?: any};

export interface IWager {
    createdAt: string;
    data: any;
    state?: any;
    win: number;
    next?: string[];
    action: number;
    bet?: number;
    params?: any;
}

interface IRound {
    wagers: IWager[] | null;
    previousState?: any;
    roundId: string | null;
}

interface IReplayResponse {
    round?: IRound & {win: number; bet: number} /*bet and win are for backward compatibility*/;
    draw?: any;
    currency: string;
    currencyDecimals: number;
    currencySymbol: string;
    balanceBefore: number;
    balanceAfter: number;
    sessionData?: any;
    config: any;
    bets: IBets;
    state: any;
    settings: ISettings;
}

export type CampaingType = "freeBets" | "prizeDrop" | "tournament";

export interface Campaign {
    campaignId: string;
    start: Date;
    end: Date;
    config: any;
    type: CampaingType;
    name: string;
    status: "planned" | "started" | "active" | "finished";
}

interface CampaignDetailed extends Campaign {
    config: any;
    playerState: any;
    campaignState: any;
}

export interface ProvablyFairSeeds {
    clientSeed: string;
    serverSeedHash: string;
    nextServerSeedHash: string;
    nonce: number;
    unfinishedGames: string[];
}

export interface ProvablyFairRoundState {
    clientSeed: string;
    serverSeedHash: string;
    nextServerSeedHash: string;
    nonce: number;
    serverSeed: string;
    status: "active" | "revealed";
}

export interface ProvablyFairDrawState {
    hash: string;
    seed: string;
    hashIndex: string;
}

export interface FairnessProof {
    hashes: {
        hex: string;
        bytes: number[];
    }[];
    randomizations: {
        limit: number;
        extractions: {
            cursor: number;
            hashIndex: number;
            offset: number;
            integer: number;
        }[];
        randomNumber: number;
        gameEvent: any;
    }[];
}

const GameHistoryTable: FC<{columns: any[]; getData: (page: number) => Promise<any[]>}> = ({columns, getData}) => {
    const [data, setData] = useState<{hasNext: boolean; hasPrev: boolean; data?: any[]}>({hasNext: false, hasPrev: false});
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        getData(page)
            .then(data => {
                setTimeout(() => setData(data as any), 0);
            })
            .finally(() => setIsLoading(false));
    }, [page]);
    return (
        <>
            <Box style={{overflow: "auto", display: "block"}}>
                {isLoading && (
                    <Box style={{height: "100%", position: "relative"}} align={"center"}>
                        <Spinner />
                    </Box>
                )}
                <DataTable columns={columns} data={data.data} />
            </Box>
            <Box style={{overflow: "auto", display: "block"}}>
                <Button size={"large"} style={{fontSize: 30, margin: 20}} disabled={isLoading || !data.hasPrev} onClick={() => setPage(page - 1)}>
                    «
                </Button>
                <Button size={"large"} style={{fontSize: 30, margin: 20}} disabled={isLoading || !data.hasNext} onClick={() => setPage(page + 1)}>
                    »
                </Button>
            </Box>
        </>
    );
};

export class Connector {
    private token: string | undefined;
    public currency: string | undefined;
    public currencyDecimals: Record<string, number> = {};
    public currencySymbols: Record<string, string> = {};
    public currencyExchangeRates: Record<string, number> = {};
    public playerId: string | undefined;
    private roundId: string | null | undefined;

    public readonly callbacks: ICallbacks | undefined;
    public readonly ui: () => UiApi;
    public settings: ISettings;
    public bets: IBets | undefined;
    private sessionId: string = v4();
    public readonly emitter: AsyncEventEmitter = new AsyncEventEmitter();

    constructor(ui: () => UiApi, settings: ISettings = {}, callbacks: ICallbacks = {}) {
        this.settings = settings;
        this.ui = ui;
        this.callbacks = callbacks;

        sessionUi(this);
        initFormatters(this);

        this.emitter.on("freeze", () => {
            this.ui().showOverlay();
            this.callbacks?.stopAutoplay && this.callbacks.stopAutoplay();
            this.callbacks?.freeze && this.callbacks.freeze();
        });
        this.emitter.on("unfreeze", () => {
            this.ui().hideOverlay();
            this.callbacks?.unfreeze && this.callbacks.unfreeze();
        });
        this.emitter.on("mute", () => this.callbacks?.mute?.());
        this.emitter.on("unmute", () => this.callbacks?.unmute?.());
        this.emitter.on("turboToggle", ({value}) => this.callbacks?.turboToggle?.(value));
        this.emitter.on("paytableToggle", ({value}) => this.callbacks?.paytableToggle?.(value));
        this.emitter.on("helpToggle", ({value}) => this.callbacks?.helpToggle?.(value));
        this.emitter.on("aboutToggle", ({value}) => this.callbacks?.aboutToggle?.(value));
        this.emitter.on("play", data => this.callbacks?.play?.(data.action, data.bet));
        this.emitter.on("stopAutoplay", () => this.callbacks?.stopAutoplay?.());
        this.emitter.on("balanceChanged", ({balance}) => this.callbacks?.balanceChanged?.(balance));
        this.emitter.on("refreshBalance", () => this.balance().then(({balance}) => this.callbacks?.balanceChanged?.(balance)));
    }

    private async fetch(method: "POST" | "GET", path: string, data: any, reloadOnError: boolean = true, server?: string) {
        let response: Response;
        let json: any;
        const encryptionKey = v4();
        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "x-session-id": this.sessionId,
            };
            if (this.token) {
                headers["Authorization"] = `Bearer ${this.token}`;
            }
            let body;
            if (this.settings.enc) {
                headers["enc"] = encryptionKey;
            }
            if (method === "GET") {
                const queryString = new URLSearchParams(data).toString();
                if (queryString.length > 0) path += "?" + queryString;
            } else {
                if (this.settings.enc) {
                    data = [xorEncrypt(JSON.stringify(data), encryptionKey)];
                }
                body = JSON.stringify(data);
            }

            const baseURL = server || this.settings.server;
            const url = baseURL ? `${ensureURL(baseURL)}${path}` : path;
            response = await fetch(url, {method, headers, body});
        } catch {
            this.showErrorMessagePopup({message: i18next.t("networkErrorMessage")}, reloadOnError);
            throw new Error("Could not fetch the data");
        }
        try {
            let text = await response.text();
            if (this.settings.enc) {
                text = xorDecrypt(text, encryptionKey as string);
            }
            json = JSON.parse(text);
        } catch (e) {
            console.error(e, json);
            this.showErrorMessagePopup({message: i18next.t("serverErrorMessage")}, reloadOnError);
            throw new Error("Could not parse the data");
        }
        if (json.error) {
            this.callbacks?.stopAutoplay && this.callbacks?.stopAutoplay();

            if (this.settings.customErrorPopups) {
                await this.emitter.emit("error", json.error);
            } else {
                this.showError(json.error);
            }

            const {code, message} = json.error;
            throw new Error(`${code}: ${message}`);
        }
        return json;
    }

    private isEmpty(value: unknown) {
        return value == null || (typeof value === "string" && value.trim().length === 0);
    }

    private showMessagePopups(popups: IPopup[]) {
        if (this.settings.customMessagePopups) {
            return this.emitter.emit("messagePopup", popups);
        }

        for (const popup of popups || []) {
            if (popup.isCustomPopup) {
                this.emitter.emit("messagePopup", [popup]);
                continue;
            }

            this.ui().showPopup({
                title: popup.title && translateKeys(popup.title),
                message: translateKeys(popup.message),
                options: popup.options?.map(option => ({...option, label: translateKeys(option.label)})),
                buttons: popup.buttons?.map(button => {
                    return {
                        label: translateKeys(button.label),
                        preventClose: button.preventClose || !this.isEmpty(button.validationFn),
                        callback: async (selectedOption?: {index: number; data: any}) => {
                            let action = button.action;
                            let data = button.data;

                            if (button.validationFn) {
                                const preventAction = !validationFunctions[button.validationFn]?.({
                                    action,
                                    data,
                                    optionIndex: selectedOption?.index,
                                });

                                if (preventAction) return;
                            }

                            this.ui().hidePopup({showNextPopup: true});

                            if (button.action === "walletMessage") {
                                ({action, data} = await this.fetch("POST", "/walletMessage", {provider: this.settings.provider, game: this.settings.game, data: {...button.data, optionData: selectedOption?.data}}));
                            }
                            if (action === "freezeBet") this.callbacks?.freezeBet?.(data.betAmount);
                            if (action === "unfreezeBet") this.callbacks?.unfreezeBet?.();
                            if (action === "exit") await this.exit(true);
                            if (action === "close") return;
                            if (action === "history") this.callbacks?.openGameHistory?.();
                            if (action === "url" && data) openURL(data.startsWith("http") ? data : this.settings[data], "_blank");

                            this.emitter.emit("chosenPopupOption", {data: selectedOption?.data || button.data});
                        },
                    };
                }),
            });
        }
    }

    private showErrorMessagePopup(error: IErrorMessageData, reload: boolean = true): void {
        const closeButton = {label: i18next.t("close"), primary: true, callback: () => null};
        switch (error.code) {
            case "INSUFFICIENT_FUNDS": {
                const depositButton = {label: i18next.t("deposit"), primary: true, callback: () => this.openDeposit()};
                this.ui().showPopup({title: i18next.t("insufficientFundsTitle"), message: i18next.t("insufficientFundsMessage"), buttons: this.isDepositSupported() ? [closeButton, depositButton] : [closeButton]});
                break;
            }
            case "LOSS_LIMIT": {
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("lossLimitMessage"), buttons: [closeButton]});
                break;
            }
            case "TIME_LIMIT": {
                this.ui().showPopup({
                    title: i18next.t("errorTitle"),
                    message: i18next.t(
                        {
                            day: "daily",
                            week: "weekly",
                            month: "monthly",
                        }[error.payload.period as string] + "TimeLimitMessage",
                    ),
                    buttons: [closeButton],
                });
                break;
            }
            case "SESSION_EXPIRED": {
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("sessionExpiredMessage"), buttons: [closeButton]});
                break;
            }
            case "TRANSACTION_REJECTED": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({message: i18next.t("transactionRejectedMessage"), buttons: [refreshButton]});
                break;
            }
            case "BLOCKED_TERRITORY": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("blockedTerritoryMessage"), buttons: [refreshButton]});
                break;
            }
            case "GAME_NOT_AVAILABLE": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("gameNotAvailableMessage"), buttons: [refreshButton]});
                break;
            }
            case "CURRENCY_NOT_SUPPORTED": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("currencyNotSupportedMessage"), buttons: [refreshButton]});
                break;
            }
            case "PLAYER_UNAUTHORIZED": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("playerUnauthorizedMessage"), buttons: [refreshButton]});
                break;
            }
            case "SERVER_UNAUTHORIZED": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("serverUnauthorizedMessage"), buttons: [refreshButton]});
                break;
            }
            case "TRANSACTION_NOT_FOUND": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("transactionNotFoundMessage"), buttons: [refreshButton]});
                break;
            }
            case "TRANSACTION_FAILED": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("transactionFailedMessage"), buttons: [refreshButton]});
                break;
            }
            case "UNKNOWN": {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: i18next.t("unknownMessage"), buttons: [refreshButton]});
                break;
            }
            default: {
                const refreshButton = {label: i18next.t("refresh"), primary: true, callback: () => this.reload()};
                this.ui().showPopup({title: i18next.t("errorTitle"), message: error.message, buttons: [reload ? refreshButton : closeButton]});
            }
        }
    }

    public async fetchExchangeRates(): Promise<Record<string, number>> {
        this.currencyExchangeRates = await this.fetch("GET", "/currencyExchangeRates", {}, false);
        return this.currencyExchangeRates;
    }

    public getExchangeRate(currency?: string): number {
        currency = currency || this.currency;
        if (!currency || this.currencyExchangeRates[currency] == null) {
            throw new Error(`Unable to specify exchange rate for currency ${currency}`);
        }
        return this.currencyExchangeRates[currency];
    }

    public convertToBaseCurrency(value: number, currency?: string): number {
        return value / this.getExchangeRate(currency);
    }

    public async fetchCurrencyDecimals(): Promise<Record<string, number>> {
        this.currencyDecimals = await this.fetch("GET", "/currencyDecimals", {}, false);
        return this.currencyDecimals;
    }

    public async fetchCurrencySymbols(): Promise<Record<string, string>> {
        this.currencySymbols = await this.fetch("GET", "/currencySymbols", {}, false);
        return this.currencySymbols;
    }

    public getCurrencyDecimal(currency?: string): number {
        currency = currency || this.currency;
        if (!currency || this.currencyDecimals[currency] == null) {
            throw new Error(`Unable to specify decimals for currency ${currency}`);
        }
        return this.currencyDecimals[currency];
    }

    public getCurrencySymbol(currency?: string): string {
        currency = currency || this.currency;
        if (!currency || this.currencySymbols[currency] == null) {
            throw new Error(`Unable to specify symbol for currency ${currency}`);
        }
        return this.currencySymbols[currency];
    }

    public floor(value: number, decimals: number): number {
        return floor(value, decimals);
    }

    public floorCurrency(value: number, currency?: string): number {
        const decimals = this.getCurrencyDecimal(currency);
        return floor(value, decimals);
    }

    public formatCurrency(value: number, currency?: string, language?: string): string {
        language = language || this.settings.language;

        const decimals = this.getCurrencyDecimal(currency);
        const symbol = this.getCurrencySymbol(currency);

        value = floor(value, decimals);

        if (this.callbacks?.formatCurrency) {
            return this.callbacks.formatCurrency(value, symbol, language, decimals);
        }

        if (this.settings.hideCurrencySymbol === "true") {
            return value.toFixed(decimals);
        }
        return defaultFormatCurrency(value, symbol, decimals, language);
    }

    public showError(errorMessageData: IErrorMessageData) {
        if (errorMessageData.popups) {
            this.showMessagePopups(errorMessageData.popups);
        } else {
            this.showErrorMessagePopup({...errorMessageData, message: i18next.t("serverErrorMessage")}, true);
        }
    }

    public showLobbyButton() {
        return this.settings.lobbyUrl ? true : false;
    }

    public getChannel() {
        return this.settings.channel;
    }

    public isDepositSupported() {
        return this.settings.customDeposit || this.settings.depositUrl;
    }

    public openDeposit() {
        if (this.settings.customDeposit) {
            this.emitter.emit("deposit");
        } else if (this.settings.depositUrl) {
            openURL(this.settings.depositUrl, "_blank");
        }
    }

    async reload(): Promise<void> {
        if (this.settings.customReload) {
            await this.emitter.emit("reload");
        } else if (this.settings.refreshUrl) {
            window.location.href = this.settings.refreshUrl;
        } else {
            window.location.reload();
        }
    }

    async balance(): Promise<{balance: number}> {
        const data = {provider: this.settings.provider, game: this.settings.game};
        const {balance} = await this.fetch("GET", "/balance", data);
        await this.emitter.emit("balance", {balance});
        return {balance};
    }

    async authenticate(): Promise<{balance: number; currency: string; currencyDecimals: number; currencySymbol: string; jurisdiction?: string; playerId: string, nickname?: string}> {
        const data = {wallet: this.settings.wallet, operator: this.settings.operator, key: this.settings.key, provider: this.settings.provider, game: this.settings.game};
        const {balance, token, currency, currencyDecimals, currencySymbol, sessionData, jurisdiction, playerId, nickname, popups} = await this.fetch("POST", "/authenticate", data);
        this.currency = currency;
        this.currencyDecimals[currency] = currencyDecimals;
        this.currencySymbols[currency] = currencySymbol;
        await this.emitter.emit("authenticated", {balance, token, currency, sessionData});
        await this.emitter.emit("balance", {balance});
        this.token = token;
        this.playerId = playerId;

        if (popups?.length) {
            this.showMessagePopups(popups);
        }

        return {balance, currency, currencyDecimals, currencySymbol, jurisdiction, playerId, nickname};
    }

    initRealityCheck(onOpen: () => any | undefined, onContinue: () => any | undefined, onGameHistory: () => any | undefined) {
        const realityCheckGameHistoryUrl = this.settings.realityCheckGameHistoryUrl;
        if (realityCheckGameHistoryUrl) {
            onGameHistory = () => {
                openURL(realityCheckGameHistoryUrl, "_blank");
            };
        }

        realityCheck(this, onOpen, onContinue, onGameHistory);
    }

    async initPromoUI() {
        await promoUi(this);
    }

    setPromoUI(headerPosition: PromoUIStyle) {
        this.ui().setPromoUI(headerPosition);
    }

    async play(
        action: string,
        bet: number | undefined = undefined,
        params: any | undefined,
        cheat: string | undefined = undefined,
        immediateComplete: boolean = false,
        asyncWin: boolean = false,
        parallelRound: boolean = false,
    ): Promise<{
        balance: number;
        finalWin?: number;
        wager: IPlayWager;
        roundId: string;
        complete?: Awaited<ReturnType<Connector["complete"]>>;
    }> {
        await this.emitter.emit("started");
        const data: any = {game: this.settings.game, provider: this.settings.provider, action, cheat: cheat || undefined, complete: immediateComplete, asyncWin};
        if (bet != null) data.bet = bet;
        if (params) data.params = params;
        if (this.roundId) data.roundId = this.roundId;

        const {balance, wager, roundId, popups, complete} = await this.fetch("POST", "/game/play", data, !!this.roundId);
        this.roundId = (complete && !wager.next?.length) || parallelRound ? null : roundId;

        await this.emitter.emit("wager", {wager: {...wager, bet}, balance, roundId});
        if (complete && !wager.next?.length) await this.emitter.emit("stopped", {roundId, balance});
        if (balance) {
            await this.emitter.emit("balance", {balance});
        }

        if (popups?.length) {
            this.showMessagePopups(popups);
        }

        return {balance, wager, roundId, complete};
    }

    async complete<T extends boolean | undefined = undefined>(params?: {roundId?: string; asyncWin?: T}): Promise<T extends true ? {balance: undefined; finalWin: number} : {balance: number; finalWin: number}> {
        const roundId = params?.roundId || this.roundId;
        const asyncWin = params?.asyncWin || false;
        const data = {game: this.settings.game, provider: this.settings.provider, roundId, asyncWin};
        this.roundId = null;
        const result = await this.fetch("POST", "/game/complete", data);
        const {finalWin, popups, balance} = result;
        await this.emitter.emit("stopped", {roundId: data.roundId, balance, finalWin});
        await this.emitter.emit("balance", {balance});
        if (popups?.length) {
            this.callbacks?.stopAutoplay && this.callbacks.stopAutoplay();
            this.showMessagePopups(popups);
        }
        return {balance, finalWin};
    }

    async info(roomId?: string): Promise<{config: any; state: any; bets: IBets; settings: ISettings; betLimits: any}> {
        const data: any = {game: this.settings.game, provider: this.settings.provider};
        if (roomId) data.roomId = roomId;
        const {config, bets, state, settings, betLimits} = await this.fetch("POST", "/game/info", data);
        this.settings = applySettings(settings);
        this.bets = bets;
        return {config, bets, state, settings: this.settings, betLimits};
    }

    async recover(skipPopup: boolean = false, complete: boolean = false): Promise<IRound | {balance: number}> {
        const data = {game: this.settings.game, provider: this.settings.provider, complete};
        const {rounds} = await this.fetch("POST", "/game/recover", data);
        const round = rounds[0];
        if (!round) {
            return {wagers: null, previousState: null, roundId: null};
        }
        const {roundId, wagers, previousState} = round;
        this.roundId = roundId;

        await this.emitter.emit("recovered", {roundId, wagers});

        const hasNext = wagers[wagers.length - 1].next?.length > 0;
        if (skipPopup) return {wagers, previousState, roundId};
        return new Promise(resolve => {
            const replayButton = {label: i18next.t("restoreReplay"), primary: true, callback: () => resolve({wagers, previousState, roundId})};
            const skipButton = {label: i18next.t("restoreSkip"), callback: async () => resolve(await this.complete())};
            this.ui().showPopup({
                message: i18next.t("restoreMessage"),
                buttons: hasNext ? [replayButton] : [skipButton, replayButton],
            });
        });
    }

    async gameFeed(amount: number): Promise<any> {
        const data = {game: this.settings.game, amount};
        return await this.fetch("GET", "/game/feed", data, false);
    }

    async cheats(): Promise<{cheats: Record<string, string[]>[]}> {
        const data = {game: this.settings.game, provider: this.settings.provider};
        const {cheats} = await this.fetch("GET", "/game/cheats", data);
        return {cheats};
    }

    async replay(roundId: string, skipPopup: boolean = true): Promise<IReplayResponse> {
        const data = {roundId};
        const {bet, win, round, draw, currency, currencyDecimals, currencySymbol, config, bets, state, balanceBefore, balanceAfter, sessionData, settings} = await this.fetch("GET", "/game/replay", data);
        this.currencyDecimals[currency] = currencyDecimals;
        this.currencySymbols[currency] = currencySymbol;

        const replay = {config, bets, state, currency, currencyDecimals, currencySymbol, round: {...round, bet, win}, draw, balanceBefore, balanceAfter, sessionData, settings};

        await this.emitter.emit("replayShown", replay);

        if (skipPopup) {
            return replay;
        }

        return new Promise(resolve => {
            this.ui().showPopup({
                // title: i18next.t("roundDetails", "Round details"),
                // title: roundId,
                message: (
                    <Box style={{overflow: "auto", display: "block"}}>
                        {/*<Heading level={4}>Round</Heading>*/}
                        <List
                            primaryKey="name"
                            secondaryKey="value"
                            data={[
                                // {name: i18next.t("playerId", "Player ID"), value: playerId},
                                {name: i18next.t("roundId"), value: roundId},
                                // {name: "Date", value: new Date(wagers[0].createdAt).toLocaleString()},
                                {name: i18next.t("bet"), value: this.formatCurrency(bet, currency)},
                                {name: i18next.t("win"), value: this.formatCurrency(win, currency)},
                            ]}
                        />
                    </Box>
                ),
                buttons: [
                    {
                        label: i18next.t("watch"),
                        primary: true,
                        callback: () => resolve(replay),
                    },
                ],
            });
        });
    }

    async gameHistory(
        skipPopup: boolean = false,
        showWatch: boolean = false,
        show: (round: IReplayResponse) => void,
        hide: () => void,
        close = () => null,
        page: number = 0,
        skipReplayMode: boolean = false,
    ): Promise<{createdAt: Date; roundId: string; win: number; bet: number; balanceBefore: number; balanceAfter: number}[] | void> {
        if (this.settings.customHistory) {
            return this.emitter.emit("history", {close});
        }

        if (this.settings.historyUrl) {
            openURL(this.settings.historyUrl, "_blank");
            return;
        }

        const getData = (page: number) => this.fetch("GET", "/game/history", {game: this.settings.game, provider: this.settings.provider, page}, false);
        if (skipPopup) return (await getData(page)).data;

        const columns: ColumnConfig<any>[] = [
            {
                property: "createdAt",
                header: <Text>{i18next.t("time", "Time")}</Text>,
                render: ({createdAt}: {createdAt: string}) => <Text style={{whiteSpace: "nowrap"}}>{new Date(createdAt).toLocaleString()}</Text>,
            },
            {
                property: "bet",
                header: <Text>{i18next.t("bet")}</Text>,
                render: ({bet}: any) => this.formatCurrency(bet),
            },
            {
                property: "win",
                header: <Text>{i18next.t("win")}</Text>,
                render: ({win}: any) => this.formatCurrency(win),
            },
            {
                property: "balance",
                header: <Text>{i18next.t("balance")}</Text>,
                render: ({balanceBefore, balanceAfter}: any) => <span style={{whiteSpace: "nowrap"}}>{this.formatCurrency(balanceBefore) + " → " + this.formatCurrency(balanceAfter)}</span>,
            },
        ];
        if (showWatch) {
            columns.push({
                property: "",
                render: ({roundId}: any) => (
                    <Button
                        onMouseDownCapture={e => e.preventDefault()}
                        onClick={async () => {
                            if (!skipReplayMode) {
                                this.ui().hidePopup();
                                this.ui().showReplay(
                                    <Button
                                        primary={true}
                                        label={i18next.t("back").toUpperCase()}
                                        onClick={() => {
                                            hide();
                                            this.ui().hideReplay();
                                            this.emitter.emit("replayHidden");
                                            this.gameHistory(skipPopup, showWatch, show, hide, close);
                                        }}
                                    />,
                                );
                            }
                            show(await this.replay(roundId, true));
                        }}
                        style={{paddingLeft: 8, paddingRight: 8, paddingBottom: 3, paddingTop: 3, whiteSpace: "nowrap"}}
                        primary={true}
                        label={i18next.t("watch").toUpperCase()}
                    />
                ),
            });
        }
        this.ui().showPopup({
            message: <GameHistoryTable columns={columns} getData={getData} />,
            buttons: [{label: i18next.t("close"), primary: true, callback: () => close()}],
        });
    }

    async exit(skipPopup: boolean = false): Promise<void> {
        const exitTarget = this.settings.exitTarget === "self" ? window : window.top || window;
        if (skipPopup) {
            if (this.settings.customExit) {
                await this.emitter.emit("exit", {lobbyUrl: this.settings.lobbyUrl});
            } else if (this.settings.lobbyUrl) {
                exitTarget.location.href = this.settings.lobbyUrl;
            } else {
                this.ui().showOverlay();
                exitTarget.history.back();
            }
            return;
        }
        return new Promise(resolve => {
            this.ui().showPopup({
                message: i18next.t("quitConfirmation"),
                buttons: [
                    {
                        label: i18next.t("yes"),
                        secondary: true,
                        callback: () => {
                            this.exit(true);
                            resolve();
                        },
                    },
                    {label: i18next.t("no"), primary: true, callback: () => resolve()},
                ],
            });
        });
    }

    getReplayUrl(roundId: string, game: string) {
        return `${this.settings.server}/launch/replay?roundId=${roundId}&game=${game}&language=${this.settings.language || "en"}`;
    }

    async getCampaigns(): Promise<Campaign[]> {
        const data = {game: this.settings.game, provider: this.settings.provider};
        const {campaigns} = await this.fetch("POST", "/campaigns", data, false, this.settings.promoServer);
        return campaigns;
    }

    async getCampaign(campaignId: string, withTranslations: boolean = false): Promise<CampaignDetailed> {
        const data = {game: this.settings.game, provider: this.settings.provider};
        const campaign = await this.fetch("GET", "/campaigns/" + campaignId, data, false, this.settings.promoServer);

        if (withTranslations) {
            let defaultCampaignThemeName = "";
            if (this.settings.defaultCampaignThemeName) {
                try {
                    defaultCampaignThemeName = JSON.parse(this.settings.defaultCampaignThemeName)[campaign.type];
                } catch (e) {
                    console.warn("Unable to parse defaultCampaignTheme", e);
                }
            }
            const theme = await this.fetch("GET", `/theme/${campaignId}/${i18next.resolvedLanguage}`, {defaultCampaignThemeName}, false, this.settings.promoServer);
            i18next.addResourceBundle(i18next.resolvedLanguage as string, "translation", theme.translations, true, true);
            updatePromoIcons(campaign.type, theme.icons);
        }

        return campaign;
    }

    getActiveCampaignsInfo() {
        const promoToolUis = getPromoToolUis();
        const campaignsInfo: Record<CampaingType, IFreeBetsCampaignInfo | IPrizeDropCampaignInfo | ITournamentCampaignInfo | null> = {
            freeBets: null,
            prizeDrop: null,
            tournament: null,
        };

        for (const [key, toolUi] of Object.entries(promoToolUis)) {
            campaignsInfo[key as keyof typeof promoToolUis] = toolUi.getActiveCampaignInfo();
        }

        return campaignsInfo;
    }

    async optCampaign(campaignId: string, optIn: boolean): Promise<void> {
        const data = {game: this.settings.game, provider: this.settings.provider, optIn};
        await this.fetch("POST", "/campaigns/" + campaignId + "/opt", data, false, this.settings.promoServer);
    }

    async acknowledgeCampaign(campaignId: string): Promise<void> {
        const data = {game: this.settings.game, provider: this.settings.provider};
        await this.fetch("POST", "/campaigns/" + campaignId + "/acknowledge", data, false, this.settings.promoServer);
    }

    async playerEvent(campaignId: string, eventId: string, eventName: string, params: any): Promise<any> {
        const data = {eventId, eventName, params, game: this.settings.game, provider: this.settings.provider};
        return await this.fetch("POST", "/event/player/" + campaignId, data, false, this.settings.promoServer);
    }

    async playerFeed(campaignId: string, playerId: string, params: any): Promise<any> {
        return await this.fetch("GET", "/feed/player/" + campaignId + "/" + playerId, params, false, this.settings.promoServer);
    }

    async campaignFeed(campaignId: string, params: any): Promise<any> {
        return await this.fetch("GET", "/feed/campaign/" + campaignId, params, false, this.settings.promoServer);
    }

    async setActiveBet(bet: number) {
        await this.emitter.emit("betChanged", {bet});
    }

    async gameLoaded(progress: number = 100) {
        await this.emitter.emit("gameLoaded", {progress});
    }

    async muted() {
        await this.emitter.emit("muted");
    }

    async unmuted() {
        await this.emitter.emit("unmuted");
    }

    async turboToggled(value: boolean) {
        await this.emitter.emit("turboToggled", {value});
    }

    async paytableToggled(value: boolean) {
        await this.emitter.emit("paytableToggled", {value});
    }

    async helpToggled(value: boolean) {
        await this.emitter.emit("helpToggled", {value});
    }

    async aboutToggled(value: boolean) {
        await this.emitter.emit("aboutToggled", {value});
    }

    async autoplayToggled(value: boolean) {
        await this.emitter.emit("autoplayToggled", {value});
    }

    // backwards compat, should be removed afterwards - https://tequityventures.slack.com/archives/C064421FSBD/p1722956238512699?thread_ts=1720126616.940479&cid=C064421FSBD
    async autoplayToggle(value: boolean) {
        await this.emitter.emit("autoplayToggled", {value});
    }

    async rooms() {
        const {rooms} = await this.fetch("GET", "/game/rooms", {provider: this.settings.provider, game: this.settings.game});
        return rooms;
    }

    async updateClientSeed(clientSeed: string): Promise<ProvablyFairSeeds> {
        if (typeof clientSeed !== "string" || clientSeed.length > 64) {
            throw new Error("Client Seed needs to be a string with at most 64 characters");
        }
        const {serverSeedHash, nextServerSeedHash, nonce, unfinishedGames} = await this.fetch("POST", "/fairness/updateClientSeed", {clientSeed}, false, this.settings.rngServer);
        return {clientSeed, serverSeedHash, nextServerSeedHash, nonce, unfinishedGames};
    }

    async activeRngSeeds(): Promise<ProvablyFairSeeds> {
        const {clientSeed, serverSeedHash, nextServerSeedHash, nonce, unfinishedGames} = await this.fetch("GET", "/fairness/activeRngSeeds", undefined, false, this.settings.rngServer);
        return {clientSeed, serverSeedHash, nextServerSeedHash, nonce, unfinishedGames};
    }

    async roundRngState(roundId: string): Promise<ProvablyFairRoundState> {
        const {clientSeed, serverSeedHash, nextServerSeedHash, nonce, serverSeed, status} = await this.fetch("GET", "/fairness/roundRngState", {roundId}, false, this.settings.rngServer);
        return {clientSeed, serverSeedHash, nextServerSeedHash, nonce, serverSeed, status};
    }

    async unhashServerSeed(serverSeedHash: string): Promise<string> {
        const {serverSeed} = await this.fetch("GET", "/fairness/unhashServerSeed", {serverSeedHash}, false, this.settings.rngServer);
        return serverSeed;
    }

    async drawRngState(drawId: string): Promise<ProvablyFairDrawState> {
        const {hash, seed, hashIndex} = await this.fetch("GET", "/fairness/drawRngState", {drawId}, false, this.settings.rngServer);
        return {hash, seed, hashIndex};
    }

    async proveFairness(rngState: {serverSeed: string; clientSeed: string; nonce: number} | {hash: string; seed: string}, data?: any): Promise<FairnessProof> {
        const request = {provider: this.settings.provider, game: this.settings.game, ...rngState, ...(data != null && {data: JSON.stringify(data)})};
        return await this.fetch("GET", "/game/proveFairness", request, false);
    }

    initMultiplayer(channel: string, onConnected: () => any, onDisconnected: () => any, onMessage: (message: any) => any) {
        const server = (this.settings.websocketServer || this.settings.server || "").replace("http://", "ws://").replace("https://", "wss://");
        const retryTimeout = [0, 1, 3];
        let ws: WebSocket | null = null;
        let pingInterval: NodeJS.Timeout | null = null;
        let pongTimeout: NodeJS.Timeout | null = null;
        const encryptionKey = this.settings.enc ? v4() : "";

        const clearPingTimers = () => {
            if (pingInterval) {
                clearInterval(pingInterval);
                pingInterval = null;
            }
            if (pongTimeout) {
                clearTimeout(pongTimeout);
                pongTimeout = null;
            }
        };

        const connect = (retryCounter: number) => {
            ws = new WebSocket(`${server}/websocket/multiplayer?token=${this.token}&channel=${channel}&enc=${encryptionKey}`);

            ws.onmessage = (event: MessageEvent<string>) => {
                let data = event.data;
                if (encryptionKey) {
                    data = xorDecrypt(data, encryptionKey);
                }

                if (data === "pong") {
                    if (pongTimeout) {
                        clearTimeout(pongTimeout);
                        pongTimeout = null;
                    }
                    return;
                }

                onMessage(JSON.parse(data));
            };

            ws.onerror = () => {
                ws!.close();
            };

            ws.onopen = () => {
                onConnected();
                retryCounter = 0;

                pingInterval = setInterval(() => {
                    const pingMessage = encryptionKey ? xorEncrypt("ping", encryptionKey) : "ping";
                    ws!.send(pingMessage);

                    pongTimeout = setTimeout(() => {
                        console.warn("Pong timeout - closing connection");
                        ws?.close();
                    }, 10 * 1000 /* 10 seconds */);
                }, 30 * 1000 /* 30 seconds */);
            };

            ws.onclose = event => {
                clearPingTimers();
                onDisconnected();
                ws = null;
                if (event.reason === "Unauthorized") {
                    return;
                }
                const delay = retryTimeout[Math.min(retryCounter, retryTimeout.length - 1)] * 1000;
                retryCounter++;
                setTimeout(() => connect(retryCounter), delay);
            };
        };

        connect(0);

        return {
            send: (type: "command" | "cheat", payload: any) => {
                if (!ws) throw new Error("WebSocket is not connected");
                let data = JSON.stringify({type, payload});
                if (encryptionKey) {
                    data = xorEncrypt(data, encryptionKey);
                }
                ws.send(data);
            },
        };
    }
}
