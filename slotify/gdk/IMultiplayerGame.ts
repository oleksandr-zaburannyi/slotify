import {IBetLimits, IGameBet} from "./IGame";
import Stats from "./stats/Stats";
import {IRandom} from "@slotify/rng/lib/random/IRandom";
import {IRandomizationBuilder} from "@slotify/rng/lib/random/createProofBuilder";

export interface IInitRequest {
    time: number;
    config: any;
}

export interface IInitResponse<TState> {
    state?: TState;
    nextTickTime: number;
}

export interface ICommandData<TParams> {
    playerId: string;
    time: number;
    action: string;
    bet?: number;
    currency?: string;
    params?: TParams;
    data?: {nickname?: string; betLimits?: IBetLimits};
}

export interface ICommandRequest<TState, TParams> extends ICommandData<TParams> {
    state: TState;
    betLimits?: IBetLimits;
}

export interface ICommand<TParams> extends ICommandData<TParams> {
    commandId: string;
    roundId: string;
}

export interface ISystemCommandData<TSystemParams> {
    systemId: string;
    time: number;
    action: string;
    params?: TSystemParams;
}

export interface ISystemCommandRequest<TState, TSystemParams> extends ISystemCommandData<TSystemParams> {
    state: TState;
}

export interface ISystemCommand<TSystemParams> extends ISystemCommandData<TSystemParams> {
    commandId: string;
}

export interface ICommandResponse {
    valid: boolean;
    instantTick: boolean;
    roundId?: string;
    message?: any;
}

export interface ITickRequest<TState, TParams, TSystemParams> {
    time: number;
    state: TState;
    commands: ICommand<TParams>[];
    drawId: string;
    systemCommands?: ISystemCommand<TSystemParams>[];
}

export interface ITickResponse<TState> {
    state?: TState;
    drawFinished?: boolean;
    nextTickTime: number;
    wins?: {[roundId: string]: number};
    cancels?: string[];
    broadcast?: any;
    messages?: {
        [playerId: string]: any;
    };
}

export type ITick<TState = any, TParams = any, TSystemParams = any> = ITickRequest<TState, TParams, TSystemParams> & ITickResponse<TState>;

export interface IConnectedRequest<TState> {
    time: number;
    state: TState;
    playerId: string;
}

export interface ISystemConnectedRequest<TState> {
    time: number;
    state: TState;
    systemId: string;
}

export interface IConnectedResponse {
    message?: any;
}

export interface IMultiplayerGame<TState = any, TParams = any, TConfig = any, TSystemParams = any> {
    readonly name: string | string[];
    readonly bets: {[key: string]: Omit<IGameBet, "validate">};

    config?(): TConfig;

    cheat?(cheat: string, params: any, state: TState): {state?: TState} | undefined;

    init(request: IInitRequest, random: IRandom): Promise<IInitResponse<TState>>;

    systemConnected?(request: ISystemConnectedRequest<TState>): IConnectedResponse;

    connected?(request: IConnectedRequest<TState>): IConnectedResponse;

    systemCommand?(request: ISystemCommandRequest<TState, TSystemParams>): Omit<ICommandResponse, "roundId">;

    command(request: ICommandRequest<TState, TParams>): ICommandResponse;

    tick(request: ITickRequest<TState, TParams, TSystemParams>, random: IRandom): Promise<ITickResponse<TState>>;

    replay(state: TState, playerId?: string): any;

    evaluate?(type: string | null, draw: {state: TState}, data?: any): any;

    proveFairness?(addRandomization: IRandomizationBuilder, data?: any): void;

    simulator?: {
        readonly stats?: {[key: string]: Stats<any>};
        config?: (strategy: string | undefined) => any;
        commands?: (strategy: string | undefined, state: TState) => Omit<ICommand<TParams>, "time">[] | undefined;
    };
}
