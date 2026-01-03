import HitFrequency from "./HitFrequency";

export default class TransactionJackpotHF<TData = any, TState = any, TParams = any> extends HitFrequency<TData, TState, TParams> {
    constructor(poolName?: string) {
        super(poolName ? wagers => !!wagers[0].promo?.transactionJackpot?.poolWins?.[poolName] : wagers => !!wagers[0].promo?.transactionJackpot);
    }
}
