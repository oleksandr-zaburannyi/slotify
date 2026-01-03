import React from "react";
import {FreeBets} from "./FreeBets";
import {PrizeDrop} from "./PrizeDrop";
import {Tournament} from "./Tournament";
import {Leaderboard} from "./Leaderboard";
import {GameJackpot} from "./GameJackpot";
import {TransactionJackpot} from "./TransactionJackpot";

export type ConfigProps<IConfig = any> = {
    value?: IConfig;
    onChange?: (value: IConfig) => void;
    edit: boolean;
};

export type EventProps<IParams, IConfig = any> = {
    onChange?: (value: IParams) => void;
    config: IConfig;
};

export type DetailsProps<IConfig = any, ICampaignState = any> = {
    config: IConfig;
    type: string;
    state: ICampaignState;
};

export type ICampaignType = {
    name: string;
    configForm?: React.FC<ConfigProps>;
    details?: React.FC<DetailsProps>;
    playerColumns?: {title: string; render: (data: {playerState: any; campaignState: any; config: any}) => React.JSX.Element}[];
    events?: {eventName: string; name: string; content: React.FC<any>}[];
    logColumns?: any[];
};

export const campaignTypes: Record<string, ICampaignType> = {
    "freeBets": FreeBets,
    "prizeDrop": PrizeDrop,
    "tournament": Tournament,
    "leaderboard": Leaderboard,
    "gameJackpot": GameJackpot,
    "transactionJackpot": TransactionJackpot,
};
