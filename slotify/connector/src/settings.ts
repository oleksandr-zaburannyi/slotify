export interface ISettings extends Record<string, string | undefined> {
    realityCheckInterval?: string;
    realityCheckElapsed?: string;
    realityCheckContinueUrl?: string;
    realityCheckGameHistoryUrl?: string;
    customReload?: string;
    customDeposit?: string;
    customExit?: string;
    customErrorPopups?: string;
    customMessagePopups?: string;
    lobbyUrl?: string;
    refreshUrl?: string;
    historyUrl?: string;
    provider?: string;
    key?: string;
    game?: string;
    operator?: string;
    wallet?: string;
    server?: string;
    promoServer?: string;
    language?: string;
    rngServer?: string;
    exitTarget?: string;
    websocketServer?: string;
    channel?: string;
    defaultCampaignThemeName?: string;
}

const _settings: ISettings = {
    key: new Date().getTime() + "_" + Math.round(Math.random() * 1000),
    language: navigator.language,
};

const urlParams = new URLSearchParams(document.location.search.substring(1));
applySettings(Object.fromEntries(urlParams));

export function applySettings(settings: ISettings = {}) {
    for (const key in settings) {
        if (settings[key] !== "" && settings[key] !== undefined) {
            _settings[key] = settings[key];
        }
    }
    return _settings;
}
