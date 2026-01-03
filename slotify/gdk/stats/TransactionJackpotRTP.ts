import RTP from "./RTP";

export default class TransactionJackpotRTP<TData = any, TState = any, TParams = any> extends RTP<TData, TState, TParams> {
    constructor(poolName?: string) {
        super(poolName ? wagers => wagers[0].promo?.transactionJackpot?.poolWins?.[poolName]?.amount || 0 : wagers => wagers[0].promo?.transactionJackpot?.jackpotWin || 0);
    }
}
