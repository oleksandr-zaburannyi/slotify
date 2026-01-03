import {Express} from "express";
import {Player} from "../db/model/Player";
import {ISessionData} from "../db/model/Session";
import {IExceptionPopup, IExceptionPopupButton} from "@slotify/shared/lib/Exception";
import {IRegulatory, TransactionType, TransactionStatus, ITransactionData, ICampaignData} from "../db/model/Transaction";

export interface IWalletBalance {
    balance: number;
    popups?: IExceptionPopup[];
}

export interface IWalletAuthenticate {
    nativeId: string;
    token: string;
    balance: number;
    currency: string;
    brand?: string;
    country?: string;
    nickname?: string;
    gender?: string;
    jurisdiction?: string;
    sessionData?: ISessionData;
    popups?: IExceptionPopup[];
    campaignTypes?: string[];
}

export interface IWalletTransaction extends ITransaction {
    transactionId: string;
    createdAt: Date;
    status?: TransactionStatus;
}

export interface ITransaction {
    type: TransactionType;
    amount: number;
    jackpotAmount?: number;
    game?: string;
    rgsRoundId?: string;
    roundId: string;
    category?: string;
    name?: string;
    provider?: string;
    rgs: string;
    roundFinished: boolean;
    campaignType?: string;
    campaignId?: string;
    walletCampaignId?: string;
    campaignData?: ICampaignData;
    winRatio?: number;
    channel?: string;
    variant?: string;
    auto?: boolean;
    ip?: string;
    playerId: string;
    rgsTransactionId: string;
    regulatory?: IRegulatory;
    data?: ITransactionData;
}

export interface ISession {
    sessionId: string;
    data?: any;
    token: string;
    active: boolean;
    isPlayerExcluded: boolean;
}

export default interface IWalletAdapter {
    sessionExpiryMinutes?: number;
    wallet: string;
    config: any;

    init(wallet: string, api: Express, path: string, config: any, whitelistedIps?: string[]): Promise<void>;

    authenticate(key: string, operator: string, provider: string, game: string, ip?: string, channel?: "desktop" | "mobile"): Promise<IWalletAuthenticate>;

    balance(player: Player, provider: string, game: string, session: ISession): Promise<IWalletBalance>;

    transaction(player: Player, transaction: IWalletTransaction, session: ISession, originalSession?: ISession | null): Promise<IWalletBalance>;

    cancel(player: Player, transaction: IWalletTransaction, session: ISession, originalSession?: ISession | null, auto?: boolean): Promise<IWalletBalance>;

    end?(player: Player, reason: "expired" | "authenticate" | "error", session: ISession): Promise<void>;

    message?(player: Player, data: any, session: ISession): Promise<{action: IExceptionPopupButton["action"]}>;
}
