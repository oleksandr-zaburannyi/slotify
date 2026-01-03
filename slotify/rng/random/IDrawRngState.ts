export interface IInitialDrawRngState {
    hash: string;
    seed: string;
}

export interface IDrawRngState extends IInitialDrawRngState {
    cursor: number;
}
