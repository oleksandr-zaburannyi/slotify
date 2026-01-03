import Exception from "@slotify/shared/lib/Exception";
import {gql} from "graphql-request";
import fetch from "@slotify/shared/lib/fetch";
import {normalizeWhitespaces} from "./gql";
import {getServiceUrl, isServiceAvailable} from "@slotify/shared/lib/urls";

export function getServices(): string[] {
    return ["adapter"].concat(["promo", "rgs", "rng"].filter(service => isServiceAvailable(service)));
}

export async function getCampaignByName(name: string): Promise<{campaignId: string; nativeIds: string[]} | undefined> {
    const variables = {name};

    const query = normalizeWhitespaces(gql`
        query ($name: JSON!) {
            campaigns(filter: {type: EQUAL, field: "name", value: $name}) {
                items {
                    campaignId
                    nativeIds
                }
            }
        }
    `);

    return (await graphQLRequest("promo", query, variables)).campaigns.items[0];
}

export async function createCampaign(data: {
    type: string;
    walletCampaignId?: string;
    name: string;
    config: any;
    start?: number;
    end?: number;
    wallets?: string[];
    providers?: string[];
    operators?: string[];
    brands?: string[];
    games?: string[];
    nativeIds?: string[];
}): Promise<string> {
    const variables = {data};

    const query = normalizeWhitespaces(gql`
        mutation ($data: CampaignInput!) {
            addCampaign(data: $data)
        }
    `);

    return (await graphQLRequest("promo", query, variables)).addCampaign;
}

export async function editCampaign(campaignId: string, data: {nativeIds?: string[]; enabled?: boolean}) {
    const variables = {campaignId, data};

    const query = normalizeWhitespaces(gql`
        mutation ($campaignId: ID!, $data: CampaignInput!) {
            editCampaign(campaignId: $campaignId, data: $data)
        }
    `);

    await graphQLRequest("promo", query, variables);
}

export async function cancelCampaign(campaignId: string) {
    await editCampaign(campaignId, {enabled: false});
}

export async function getFreeBetsCampaignDetails(campaignId: string): Promise<{name: string; config: {bets: number; amount: number; currency?: string}; enabled: boolean} | undefined> {
    const query = normalizeWhitespaces(gql`
        query ($campaignId: JSON!) {
            campaigns(filter: {type: EQUAL, field: "campaignId", value: $campaignId}) {
                items {
                    name
                    config
                    enabled
                }
            }
        }
    `);

    const variables = {campaignId};

    return (await graphQLRequest("promo", query, variables)).campaigns.items[0];
}

export async function getFreeBetsPlayerDetails(campaignId: string, playerId: string): Promise<{finished: boolean; state: {totalWin: number; used: number; amount: number}}> {
    const query = normalizeWhitespaces(gql`
        query ($campaignId: JSON!, $playerId: JSON!) {
            campaignPlayers(filter: [{type: EQUAL, field: "campaignId", value: $campaignId}, {type: EQUAL, field: "playerId", value: $playerId}]) {
                items {
                    finished
                    state
                }
            }
        }
    `);

    const variables = {campaignId, playerId};

    return (await graphQLRequest("promo", query, variables))?.campaignPlayers.items[0];
}

export async function getNativePlayerActiveFreeBetsCampaigns(
    nativeId: string,
    wallet: string,
): Promise<{campaignId: string; name: string; config: {bets: number; amount: number; currency?: string}; createdAt: Date; end: Date; games: string[]; brands?: string[]}[]> {
    const query = normalizeWhitespaces(gql`
        query ($nativeId: JSON!, $wallet: JSON!, $currentDate: JSON!) {
            campaigns(
                filter: [
                    {type: CONTAIN, field: "nativeIds", value: [$nativeId]}
                    {type: CONTAIN, field: "wallets", value: [$wallet]}
                    {type: EQUAL, field: "type", value: "freeBets"}
                    {type: GREATER, field: "end", value: $currentDate}
                    {type: EQUAL, field: "enabled", value: true}
                ]
            ) {
                items {
                    campaignId
                    name
                    config
                    createdAt
                    end
                    games
                    brands
                }
            }
        }
    `);

    const variables = {nativeId, wallet, currentDate: new Date().toISOString()};

    return (await graphQLRequest("promo", query, variables)).campaigns.items;
}

export async function getGameActiveFreeBetsCampaigns(game: string, wallet: string): Promise<{campaignId: string; name: string}[]> {
    const query = normalizeWhitespaces(gql`
        query ($game: JSON!, $wallet: JSON!, $currentDate: JSON!) {
            campaigns(
                filter: [
                    {type: CONTAIN, field: "games", value: [$game]}
                    {type: CONTAIN, field: "wallets", value: [$wallet]}
                    {type: EQUAL, field: "type", value: "freeBets"}
                    {type: GREATER, field: "end", value: $currentDate}
                    {type: EQUAL, field: "enabled", value: true}
                ]
            ) {
                items {
                    name
                    campaignId
                }
            }
        }
    `);

    const variables = {game, wallet, currentDate: new Date().toISOString()};

    return (await graphQLRequest("promo", query, variables)).campaigns.items;
}

export async function getAvailableBets(variables: {wallet: string; operator: string; brand?: string; provider: string; game: string; currency: string}): Promise<number[]> {
    const {wallet, operator, brand, provider, game, currency} = variables;
    const r = await getAvailableBetsBulk({wallet, operator, brand, provider, games: [game], currencies: [currency]});
    if (!r[game] || !r[game][currency]) throw new Exception("Couldn't find available bet");
    return r[game] && r[game][currency];
}

export async function getAvailableBetsBulk(variables: {
    wallet: string;
    operator?: string;
    brand?: string;
    provider?: string;
    games: string[];
    jurisdiction?: string;
    currencies?: string[];
}): Promise<Record</*game*/ string, Record</*currency*/ string, /*main bets*/ number[]>>> {
    const query = normalizeWhitespaces(gql`
        query ($wallet: String!, $operator: String, $brand: String, $provider: String, $games: [String!]!, $jurisdiction: String, $currencies: [String!]) {
            availableBetsBulk(wallet: $wallet, operator: $operator, brand: $brand, provider: $provider, games: $games, jurisdiction: $jurisdiction, currencies: $currencies) {
                bets
            }
        }
    `);

    return (await graphQLRequest("rgs", query, variables)).availableBetsBulk.bets;
}

export async function getCriticalFiles(variables: {games: string[]}): Promise<{items: {name: string; jurisdictions: string[]; declaredChecksum: string; loggedChecksum: string; component: string}[]}> {
    const query = gql`
        query ($games: JSON) {
            criticalFiles(limit: 100000, filter: {field: "component", type: IN, value: $games}) {
                items {
                    name
                    component
                    jurisdictions
                    loggedChecksum
                    declaredChecksum
                }
            }
        }
    `;

    return (await graphQLRequest("rgs", query, variables)).criticalFiles;
}

export async function getRgsCurrencies(): Promise<string[]> {
    const query = `
        query {
            currencyList
        }
    `;

    return (await graphQLRequest("rgs", query, {})).currencyList;
}

export async function getSettings(variables: {wallet?: string; operator?: string; brand?: string; provider?: string; game?: string; jurisdiction?: string; currency?: string}): Promise<Record<string, string>> {
    const query = normalizeWhitespaces(gql`
        query ($wallet: String, $operator: String, $brand: String, $provider: String, $game: String, $jurisdiction: String, $currency: String) {
            checkSettings(wallet: $wallet, operator: $operator, brand: $brand, provider: $provider, game: $game, jurisdiction: $jurisdiction, currency: $currency) {
                settings
            }
        }
    `);

    return (await graphQLRequest("rgs", query, variables)).checkSettings.settings;
}

export async function graphQLRequest(service: string, query: string, variables: any, token?: string, timeout?: number) {
    const headers: Record<string, string> = {"Content-Type": "application/json"};
    if (token) headers["Authorization"] = "Bearer " + token;
    const response = await fetch(getServiceUrl(service) + "/graphql", {
        headers,
        method: "POST",
        body: JSON.stringify({query, variables, account: {}}),
        timeout,
    });

    if (!response.ok) {
        throw new Exception(`Unable to make GraphQL call to service: ${service}`);
    }
    const json = await response.json();
    if (json.errors) {
        throw new Exception(json.errors[0].message);
    }
    return json.data;
}
