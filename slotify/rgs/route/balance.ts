import {balanceRequest} from "../util/adapterUtil";

export default async function balance(playerId: string, provider: string, game: string): Promise<{balance: number}> {
    const {balance} = await balanceRequest(playerId, provider, game);
    return {balance};
}
