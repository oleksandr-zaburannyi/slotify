import {IPlayer, ITransactionRequest} from "./routes";
import {IToolType} from "../tools/tools";
import {IStreamAccumulator, IStreamCampaignState, IStreamSynchronizedAccumulator} from "./streams";
import {IStreamEntry} from "../db/model/StreamEntry";

export type IPrize =
    | {comment?: string; playerId: string; type: "cash"; data: {amount: number; jackpotAmount?: number; currency?: string}}
    | {comment?: string; playerId: string; type: "item"; data: {name: string}}
    | {
          comment?: string;
          playerId: string;
          type: "campaign";
          data: {
              type: IToolType;
              name: string;
              config?: any;
              start?: Date;
              end?: Date;
              providers?: string[];
              games?: string[];
              wallets?: string[];
              operators?: string[];
              brands?: string[];
              playerIds?: string[];
              nativeIds?: string[];
          };
      };

export type ILog<T = any> = {name: string; data: T};

export type ICampaignSetup<ICampaignConfig> = {
    config: ICampaignConfig;
    name: string;
    providers?: string[];
    games?: string[];
    wallets?: string[];
    operators?: string[];
    brands?: string[];
    playerIds?: string[];
    nativeIds?: string[];
    start?: any;
    end?: any;
    enabled?: boolean;
};

export interface ITool<ICampaignConfig = any, IPlayerState = any, ICampaignState = any, ILogData = any, TEntryData = any, TAccumulationData = any, TPlayData = any> {
    autoOptIn?: boolean;
    snapshotCron?: string;

    create?(campaignSetup: ICampaignSetup<ICampaignConfig>): Promise<ICampaignState | TAccumulationData | void>;

    edit?(previousCampaignSetup: ICampaignSetup<ICampaignConfig>, previousCampaignState: ICampaignState, newCampaignSetup: ICampaignSetup<ICampaignConfig>): Promise<ICampaignState | void>;

    visible?(request: {config: ICampaignConfig; player: IPlayer; loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>; loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>}): Promise<boolean>;

    init?(request: {config: ICampaignConfig; player: IPlayer; loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>}): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; logs?: ILog<ILogData>[]} | void>;

    opt?(request: {
        optIn: boolean;
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; logs?: ILog<ILogData>[]} | void>;

    acknowledge?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; prizes?: IPrize[]; logs?: ILog<ILogData>[]} | void>;

    withdraw?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        transaction: ITransactionRequest;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; prizes?: IPrize[]; finished?: boolean; free?: boolean; jackpotAmount?: number; logs?: ILog<ILogData>[]; campaignData?: any} | void>;

    withdrawFinished?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        transaction: ITransactionRequest;
        start: Date;
        end: Date;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; prizes?: IPrize[]; finished?: boolean; data?: any; logs?: ILog<ILogData>[]} | void>;

    withdrawFailed?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        transaction: ITransactionRequest;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; logs?: ILog<ILogData>[]} | void>;

    cancel?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        transaction: ITransactionRequest;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; logs?: ILog<ILogData>[]} | void>;

    deposit?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        transaction: ITransactionRequest;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; prizes?: IPrize[]; finished?: boolean; free?: boolean; jackpotAmount?: number; logs?: ILog<ILogData>[]; campaignData?: any} | void>;

    depositFinished?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        transaction: ITransactionRequest;
        start: Date;
        end: Date;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; prizes?: IPrize[]; finished?: boolean; data?: any; logs?: ILog<ILogData>[]} | void>;

    playerEvent?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        eventName: string;
        params: any;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; prizes?: IPrize[]; finished?: boolean; data?: any; logs?: ILog<ILogData>[]} | void>;

    systemEvent?(request: {
        config: ICampaignConfig;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        eventName: string;
        params: any;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{campaignState?: ICampaignState; prizes?: IPrize[]; data?: any; logs?: ILog<ILogData>[]} | void>;

    campaignFeed?(request: {config: ICampaignConfig; start?: Date | null; end?: Date | null; loadCampaignState: () => Promise<ICampaignState>; params: Record<string, string>}): Promise<any>;

    playerFeed?(request: {config: ICampaignConfig; start?: Date | null; end?: Date | null; loadPlayerState: () => Promise<IPlayerState>; loadCampaignState: () => Promise<ICampaignState>; params: Record<string, string>}): Promise<any>;

    campaignData?(request: {config: ICampaignConfig; start?: Date | null; end?: Date | null; loadPlayerState: () => Promise<IPlayerState>; loadCampaignState: () => Promise<ICampaignState>; params: Record<string, string>}): Promise<any>;

    campaignEnd?(request: {config: ICampaignConfig; loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>}): Promise<{campaignState?: ICampaignState; prizes?: IPrize[]; logs?: ILog<ILogData>[]} | void>;

    accumulator?: IStreamAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;

    play?(request: {
        config: ICampaignConfig;
        player: IPlayer;
        playRequest: {roundId: string; step: number; data: TPlayData};
        roundId: string;
        loadPlayerState: (readOnly?: boolean) => Promise<IPlayerState>;
        loadCampaignState: (readOnly?: boolean) => Promise<ICampaignState>;
        streamEntry: (data: TEntryData) => Promise<IStreamEntry<TEntryData>>;
        streamSynchronizedAccumulator: IStreamSynchronizedAccumulator<ICampaignConfig, TEntryData, TAccumulationData>;
    }): Promise<{playerState?: IPlayerState; campaignState?: ICampaignState; data?: any} | void>;
}

export type IStreamTool<ICampaignConfig = any, IPlayerState = any, ILogData = any, TEntryData = any, TAccumulationData = any, TPlayData = any> = ITool<
    ICampaignConfig,
    IPlayerState,
    IStreamCampaignState<TAccumulationData>,
    ILogData,
    TEntryData,
    TAccumulationData,
    TPlayData
>;
