import {AsyncLocalStorage} from "async_hooks";

type IStore = {correlationId: string; sessionId: string};
const asyncLocalStorage = new AsyncLocalStorage<IStore>();
const getRequestContext = () => {
    return asyncLocalStorage.getStore();
};

export const correlationData = {
    get "x-correlation-id"() {
        return getRequestContext()?.correlationId || "-";
    },
    get "x-session-id"() {
        return getRequestContext()?.sessionId || "-";
    },
};

export const startCorrelation = async (store: IStore, func: () => any) => {
    return asyncLocalStorage.run(store, func);
};
