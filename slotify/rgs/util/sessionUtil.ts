import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {ISettings, ISettingsFilter, Settings} from "../db/model/Settings";

export type ISessionData = {
    italy?: {
        sessionId: string;
        ticketid: string;
    };
    betConfig?: {
        minBet?: number;
        maxBet?: number;
        maxBonusBet?: number;
        maxExposure?: number;
        defaultBet?: number;
    };
    settings?: {
        lobbyUrl?: string;
        historyUrl?: string;
        depositUrl?: string;
        [key: string]: any;
    };
    currencyRate?: number;
    gameVariant?: string;
    [key: string]: any;
};

export const getSessionData = async (sessionId: string): Promise<ISessionData> => {
    const {data} = await fetchAndParse(`${getServiceUrl("adapter")}/api/sessions?sessionId=${sessionId}`);
    return data || {};
};

export async function getSessionSettings(filters: ISettingsFilter, sessionData: ISessionData, onlyVisibleInClient: boolean = false): Promise<ISettings> {
    const settings = await Settings.getValues(filters, onlyVisibleInClient);
    const sessionSettings = sessionData.settings || {};
    return Object.assign(settings, sessionSettings);
}
