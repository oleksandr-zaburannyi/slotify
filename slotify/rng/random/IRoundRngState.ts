export interface IInitialRngState {
    clientSeed: string;
    serverSeed: string;
    nonce: number;
}

export interface IRoundRngState extends IInitialRngState {
    cursor: number;
}
