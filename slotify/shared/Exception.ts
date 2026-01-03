import {StatusCode} from "./StatusCode";

// used for translaction keys with placeholders
type IExceptionPopupTranslation = {
    key: string;
    data: Record<string, string>;
};

export type IExceptionPopupButton = {
    label: string | IExceptionPopupTranslation; //label - resource id or text
    action:
        | "exit" //exit game
        | "close" //do nothing
        | "url" //open URL
        | "history" //open in-game history
        | "walletMessage" //sends a wallet message which returns action
        | "freezeBet" //freezes game bet for free bets
        | "unfreezeBet"; //unfreezes game bet for free bets
    validationFn?: string;
    data?: any;
    preventClose?: boolean; // if true, does not close the poup
};

export type IExceptionPopupOption = {
    label: string | IExceptionPopupTranslation;
    value: string | number;
    data?: any;
};

export type IExceptionPopup = {
    title?: string | IExceptionPopupTranslation;
    message: string | IExceptionPopupTranslation;
    options?: IExceptionPopupOption[];
    buttons?: IExceptionPopupButton[];
    isCustomPopup?: boolean;
};

export default class extends Error {
    readonly status?: StatusCode;
    readonly code?: string;
    readonly data?: any;
    readonly payload?: any;
    readonly popups?: IExceptionPopup[];

    constructor(
        message: string,
        {
            status,
            code,
            data,
            payload,
            popups,
        }: {
            status?: StatusCode; // HTTP status code
            code?: string; // custom error code, depending on the context
            data?: any; // logged, but not exposed on the APIs
            payload?: any; // exposed on the APIs,
            popups?: IExceptionPopup[]; // tequity-standard error popups related to the exception
        } = {},
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.data = data;
        this.payload = payload;
        this.popups = popups;
    }

    toJSON() {
        return {
            message: this.message,
            code: this.code,
            data: this.data,
            payload: this.payload,
            popups: this.popups,
            stack: this.stack,
        };
    }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
Error.prototype.toJSON = function () {
    return {
        name: this.name,
        message: this.message,
        stack: this.stack,
    };
};
