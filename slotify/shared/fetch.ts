import Exception from "./Exception";
import {correlationData} from "./asyncContext";
import {StatusCode} from "./StatusCode";
import {fetch as undiciFetch, Agent, RequestInit, RequestInfo, Response as UndiciResponse} from "undici";

// Override undici Response.json() to return Promise<any> like native Node.js fetch
type Response = Omit<UndiciResponse, "json"> & {
    json(): Promise<any>;
};

type FetchOptions = Omit<RequestInit, "signal"> & {timeout?: number};

const keepAliveTimeout = process.env.HTTP_AGENT_KEEPALIVE_TIMEOUT !== undefined ? Number(process.env.HTTP_AGENT_KEEPALIVE_TIMEOUT) : 10_000;
const connectTimeout = process.env.HTTP_AGENT_CONNECT_TIMEOUT !== undefined ? Number(process.env.HTTP_AGENT_CONNECT_TIMEOUT) : 1_000;
const autoSelectFamilyAttemptTimeout = process.env.HTTP_AGENT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT !== undefined ? Number(process.env.HTTP_AGENT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT) : 5_000;

const httpAgent = new Agent({
    keepAliveTimeout,
    autoSelectFamilyAttemptTimeout,
    connect: {timeout: connectTimeout},
});

const createFetchConfig = (init?: FetchOptions): RequestInit => {
    return {
        ...init,
        headers: {...init?.headers, ...correlationData},
        signal: AbortSignal.timeout(init?.timeout || 10_000),
        dispatcher: init?.dispatcher || httpAgent,
    };
};

const fetch = async (input: RequestInfo, init?: FetchOptions): Promise<Response> => {
    const config = createFetchConfig(init);
    return undiciFetch(input, config);
};

export {Agent, RequestInit, RequestInfo, Response};

export async function fetchAndParse(input: RequestInfo, init?: FetchOptions, repeat = 1): Promise<any> {
    let response: Response | null = null;

    do {
        try {
            response = await fetch(input, init);
        } catch (e) {
            if (repeat === 0) {
                throw new Exception(`Couldn't fetch data from service (${(e as Error).message})`, {data: {code: "NETWORK_ERROR", url: input, init, error: e}});
            }
        }
    } while (!response && --repeat >= 0);
    let text;
    let data;
    try {
        text = (await response?.text()) || "";
        data = JSON.parse(text);
    } catch (e) {
        throw new Exception("Couldn't parse data from service", {data: {url: input, init, text, error: e}});
    }
    if (data.error) {
        throw new Exception(data.error.message, {
            status: StatusCode.BAD_REQUEST,
            code: data.error.code,
            data: {url: input, init, text, originalData: data.error.data, initial: false},
            payload: data.error.payload,
            popups: data.error.popups,
        });
    }
    if (!response?.ok) {
        throw new Exception("Incorrect response from service", {
            status: response?.status,
            data: {url: input, init, text},
        });
    }
    return data;
}

export default fetch;
