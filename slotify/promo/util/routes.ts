import {Campaign} from "../db/model/Campaign";
import Exception from "@slotify/shared/lib/Exception";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {PlayerState} from "../db/model/PlayerState";
import {EntityManager, IsNull} from "typeorm";
import {lazyLoadState, saveState} from "./states";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {CampaignResponse} from "../db/model/CampaignResponse";
import {getTool, IToolType} from "../tools/tools";
import {payPrizes, savePrizes} from "./prizes";
import {CampaignPrize} from "../db/model/CampaignPrize";
import {CampaignLog} from "../db/model/CampaignLog";
import {ILog, ITool} from "./ITool";
import {accumulateStreamSynchronously, IStreamAccumulator, streamEntry} from "./streams";
import logger from "@slotify/shared/lib/logger";
import {getCampaignsForRound} from "./getCampaignsForRound";

export interface IPlayer {
    playerId: string;
    nativeId: string;
    wallet: string;
    operator: string;
    brand: string;
    provider: string;
    game: string;
    currency: string;
    jurisdiction: string;
    nickname?: string;
}

export interface ITransactionResponse {
    callFinished?: boolean;
    campaignType?: string;
    campaignId?: string;
    walletCampaignId?: string;
    campaignData?: any;
    jackpotAmount?: number;
    data?: Record<string, any>;
    campaigns: string[];
}

export interface ITransactionRequest {
    amount: number;
    game?: string;
    provider?: string;
    roundId: string;
    transactionId: string;
    roundFinished?: boolean;
    category?: string;
}

export async function opt(optIn: boolean, campaignId: string, player: IPlayer) {
    const {status, config, tool} = await Campaign.getById(campaignId, player);
    if (status !== "started") throw new Exception("Campaign needs to be started in order to opt", {data: {campaignId}});

    await getConnection("primary").transaction(async manager => {
        if (await manager.findOne(PlayerState, {where: {campaignId, playerId: player.playerId, optIn: IsNull()}, lock: {mode: "pessimistic_write"}})) {
            await manager.update(PlayerState, {campaignId, playerId: player.playerId}, {optIn});
            if (tool.opt) {
                const result: any = (await tool.opt({optIn, config, player, ...lazyLoadState(manager, campaignId, player.playerId)})) || {};
                await saveState(manager, campaignId, player.playerId, result.campaignState, result.playerState);
                if (result.logs) {
                    await insertLogs(manager, campaignId, result.logs);
                }
            }
        }
    });

    return {optIn};
}

export async function acknowledge(campaignId: string, player: IPlayer) {
    const {status, config, tool} = await Campaign.getById(campaignId, player);

    if (status !== "finished") {
        throw new Exception("Campaign needs to be finished in order to acknowledge it", {data: {campaignId}});
    }

    const prizes: CampaignPrize[] = [];

    await getConnection("primary").transaction(async manager => {
        if (await manager.findOne(PlayerState, {where: {campaignId, playerId: player.playerId, acknowledged: IsNull()}, lock: {mode: "pessimistic_write"}})) {
            await manager.update(PlayerState, {campaignId, playerId: player.playerId}, {acknowledged: true});
            if (tool.acknowledge) {
                const result: any = (await tool.acknowledge({config, player, ...lazyLoadState(manager, campaignId, player.playerId)})) || {};
                await saveState(manager, campaignId, player.playerId, result.campaignState, result.playerState);
                if (result.prizes) {
                    prizes.push(...(await savePrizes(manager, result.prizes, campaignId)));
                }
                if (result.logs) {
                    await insertLogs(manager, campaignId, result.logs);
                }
            }
        }
    });

    await payPrizes(prizes);

    return {acknowledge: true};
}

export async function authenticate(player: IPlayer, campaignTypes?: IToolType[]) {
    const campaigns = await Campaign.getAll(player, undefined, true, campaignTypes);

    for (const campaign of campaigns) {
        const {status, tool, campaignId, config} = campaign;
        await initStarted(campaignId, status, player, tool, config);
    }
    return {auth: true};
}

export async function initStarted(campaignId: string, status: "planned" | "started" | "active" | "finished", player: IPlayer, tool: ITool, config: any) {
    if (status === "started") {
        const {playerId} = player;
        await getConnection("primary").transaction(async manager => {
            if (!(await manager.findOne(PlayerState, {where: {campaignId, playerId}, lock: {mode: "pessimistic_write"}}))) {
                await manager.insert(PlayerState, {campaignId, playerId, init: true});
                if (tool.init) {
                    const {loadCampaignState} = lazyLoadState(manager, campaignId, playerId);
                    const result = (await tool.init({config, player, loadCampaignState})) || {};
                    await saveState(manager, campaignId, player.playerId, result.campaignState, result.playerState);
                    if (result.logs) {
                        await insertLogs(manager, campaignId, result.logs);
                    }
                }
            }
        });
        if (tool.autoOptIn) {
            await opt(true, campaignId, player);
            status = "active";
        }
    }
    return status;
}

export async function campaigns(player: IPlayer) {
    const campaigns = (await Campaign.getAll(player)).map(({campaignId, name, type, start, end, status}) => ({campaignId, name, type, start, end, status}));

    return {campaigns};
}

export async function campaign(campaignId: string, player: IPlayer) {
    const {playerId} = player;
    let {start, end, type, name, status, config, tool} = await Campaign.getById(campaignId, player);
    status = await initStarted(campaignId, status, player, tool, config);
    const {loadCampaignState, loadPlayerState} = lazyLoadState(getConnection("primary").manager, campaignId, playerId);

    let campaignState = await loadCampaignState(true);
    campaignState = removeUnderscoredKeys(tool.accumulator ? campaignState.data : campaignState);

    return {
        campaignId,
        start,
        end,
        type,
        name,
        status,
        config: removeUnderscoredKeys(config),
        campaignState,
        playerState: removeUnderscoredKeys(await loadPlayerState(true)),
    };
}

export async function playerEvent(campaignId: string, player: IPlayer, eventName: string, eventId: string, params: any) {
    const prizes: CampaignPrize[] = [];
    const {playerId} = player;
    let response: any = {};
    const responseId = "playerEvent_" + "_" + eventName + "_" + eventId;

    const campaignResponse = await CampaignResponse.findOneBy({responseId});
    if (campaignResponse) {
        return campaignResponse.response;
    }
    await getConnection("primary").transaction(async manager => {
        const campaign = await manager.findOneBy(Campaign, {campaignId});
        if (!campaign) throw new Exception("Couldn't find campaign", {data: {campaignId}});
        const tool = getTool(campaign.type);
        const {config} = campaign;

        if (!tool.playerEvent) throw new Exception("Event not implemented");
        const result = (await tool.playerEvent({player, params, eventName, config, ...lazyLoadState(getConnection("primary").manager, campaignId, playerId)})) || {};
        await saveState(manager, campaignId, playerId, result.campaignState, result.playerState);
        if (result.finished) {
            await manager.update(PlayerState, {campaignId, playerId}, {finished: true});
        }
        if (result.data) {
            response = result.data;
        }
        if (result.prizes) {
            prizes.push(...(await savePrizes(manager, result.prizes, campaignId)));
        }
        if (result.logs) {
            await insertLogs(manager, campaignId, result.logs);
        }
        await manager.save(CampaignResponse, {responseId, response});
    });

    await payPrizes(prizes);
    return response;
}

export async function systemEvent(campaignId: string, eventName: string, eventId: string, params: any) {
    const prizes: CampaignPrize[] = [];
    let response: any = {};
    const responseId = "playerEvent_" + eventName + "_" + eventId;

    const campaignResponse = await CampaignResponse.findOneBy({responseId});
    if (campaignResponse) {
        return campaignResponse.response;
    }
    await getConnection("primary").transaction(async manager => {
        const campaign = await manager.findOneBy(Campaign, {campaignId});
        if (!campaign) throw new Exception("Couldn't find campaign", {data: {campaignId}});
        const tool = getTool(campaign.type);
        const {config} = campaign;

        if (!tool.systemEvent) throw new Exception("Event not implemented");
        const {loadCampaignState} = lazyLoadState(manager, campaignId, null);

        const request: any = {params, eventName, config, loadCampaignState};

        if (tool.accumulator) {
            request.streamEntry = <TEntryData>(data: TEntryData) => streamEntry(campaignId, data);
            request.streamSynchronizedAccumulator = <TConfig, TEntryData, TAccumulatorData>(accumulator: IStreamAccumulator<TConfig, TEntryData, TAccumulatorData>) =>
                accumulateStreamSynchronously<TConfig, TEntryData, TAccumulatorData>(campaign.type, campaignId, accumulator);
            request.loadCampaignState = () => {
                throw new Exception("Stream campaigns need to manage Campaign State via accumulators", {data: {campaignId, type: campaign.type}});
            };
        }

        const result = (await tool.systemEvent(request)) || {};
        await saveState(manager, campaignId, null, result.campaignState, null);
        if (result.data) {
            response = result.data;
        }
        if (result.prizes) {
            prizes.push(...(await savePrizes(manager, result.prizes, campaignId)));
        }
        if (result.logs) {
            await insertLogs(manager, campaignId, result.logs);
        }
        await manager.save(CampaignResponse, {responseId, response});
    });

    await payPrizes(prizes);
    return response;
}

export async function campaignFeed(campaignId: string, params: any) {
    const campaign = await Campaign.findOneBy({campaignId});
    if (!campaign) throw new Exception("Couldn't find campaign", {data: {campaignId}});
    const tool = getTool(campaign.type);
    const {config, start, end} = campaign;

    if (!tool.campaignFeed) throw new Exception("Feed not implemented");
    const {loadCampaignState} = lazyLoadState(getConnection("primary").manager, campaignId, null, true);
    const request: any = {params, config, start, end, loadCampaignState};

    return await tool.campaignFeed(request);
}

export async function playerFeed(campaignId: string, playerId: string, params: any) {
    const campaign = await Campaign.findOneBy({campaignId});
    if (!campaign) throw new Exception("Couldn't find campaign", {data: {campaignId}});
    const tool = getTool(campaign.type);
    const {config, start, end} = campaign;

    if (!tool.playerFeed) throw new Exception("Feed not implemented");
    return await tool.playerFeed({params, config, start, end, ...lazyLoadState(getConnection("primary").manager, campaignId, playerId, true)});
}

export async function transactions(mode: "withdraw" | "deposit" | "withdrawFinished" | "depositFinished" | "cancel" | "withdrawFailed", player: IPlayer, transaction: ITransactionRequest) {
    const {transactionId, roundId} = transaction;
    const {playerId} = player;
    const prizes: CampaignPrize[] = [];

    const responseId = mode + "_" + transactionId;
    const campaignResponse = await CampaignResponse.findOneBy({responseId});
    if (campaignResponse) {
        return campaignResponse.response;
    }

    const {campaigns, response} = await getCampaignsForRound(player, roundId, mode);

    const hasAnyToolCalls = campaigns.some(({tool}) => !!tool[mode]);

    const finishedMode = (mode + "Finished") as "withdrawFinished" | "depositFinished";
    response.callFinished = campaigns.some(({tool}) => !!tool[finishedMode]);

    if (hasAnyToolCalls) {
        const needsWithdrawLookup = mode === "cancel" || mode === "withdrawFailed";
        const withdrawResponse = needsWithdrawLookup ? await CampaignResponse.findOneBy({responseId: "withdraw_" + transactionId}) : null;

        await getConnection("primary").transaction(async manager => {
            for (const {campaignId, walletCampaignId, tool, config, type, start, end} of campaigns) {
                if (end && end.getTime() < Date.now()) continue;

                const func = tool[mode];
                response.campaigns.push(campaignId);
                const withdrawProcessedForCleanup = !needsWithdrawLookup || withdrawResponse?.response.campaigns.includes(campaignId);
                if (func && withdrawProcessedForCleanup) {
                    const request: any = {config, player, ...lazyLoadState(manager, campaignId, playerId), transaction, start, end};

                    if (tool.accumulator) {
                        request.streamEntry = <TEntryData>(data: TEntryData) => streamEntry(campaignId, data);
                        request.streamSynchronizedAccumulator = <TConfig, TEntryData, TAccumulatorData>(accumulator: IStreamAccumulator<TConfig, TEntryData, TAccumulatorData>) =>
                            accumulateStreamSynchronously<TConfig, TEntryData, TAccumulatorData>(type, campaignId, accumulator);
                        request.loadCampaignState = () => {
                            throw new Exception("Stream campaigns need to manage Campaign State via accumulators", {
                                data: {
                                    campaignId,
                                    type,
                                    mode,
                                },
                            });
                        };
                    }

                    const result: any = (await func(request)) || {};

                    if (tool.accumulator && result.campaignState) {
                        throw new Exception("Stream campaigns need to manage Campaign State via accumulators", {
                            data: {
                                campaignId,
                                type,
                                mode,
                            },
                        });
                    }

                    await saveState(manager, campaignId, playerId, result.campaignState, result.playerState);
                    if (result.free) {
                        if (response.campaignId || response.campaignType) throw new Exception("Couldn't overwrite campaignType and campaignId", {data: {response, campaignId}});
                        response.campaignType = type;
                        response.campaignId = campaignId;
                        response.walletCampaignId = walletCampaignId;
                    }
                    if (result.campaignData) {
                        if (response.campaignData)
                            throw new Exception("Couldn't overwrite campaignData", {
                                data: {
                                    response,
                                    campaignId,
                                },
                            });
                        response.campaignData = result.campaignData;
                    }
                    if (result.jackpotAmount) {
                        if (response.jackpotAmount) throw new Exception("Couldn't overwrite jackpotAmount", {data: {response, campaignId}});
                        response.jackpotAmount = result.jackpotAmount;
                    }
                    if (result.data) {
                        response.data ||= {};
                        response.data[type] = result.data;
                    }
                    if (result.finished) {
                        await manager.update(PlayerState, {campaignId, playerId}, {finished: true});
                    }
                    if (result.prizes) {
                        prizes.push(...(await savePrizes(manager, result.prizes, campaignId)));
                    }
                    if (result.logs) {
                        await insertLogs(manager, campaignId, result.logs);
                    }
                }
            }
            await manager.insert(CampaignResponse, {responseId, response, roundId});
        });

        await payPrizes(prizes);
    }
    return response;
}

export interface IPlayData {
    campaigns: {[campaignType: string]: any};
}

export async function play(player: IPlayer, roundId: string, step: number, campaigns: {[campaignType: string]: any}) {
    logger.info("Campaign play request processing started", {player, campaigns});

    const activeCampaigns = (await Campaign.getAll(player, undefined, false, Object.keys(campaigns))).filter(campaign => campaign.status === "active");

    const {playerId} = player;

    const response: {[campaignType: string]: any} = {};
    for (const [campaignType, campaignData] of Object.entries(campaigns)) {
        const activeCampaign = activeCampaigns.find(activeCampaign => activeCampaign.type === campaignType);
        if (!activeCampaign) {
            throw new Exception("Campaign requested by the game promo play does not exist", {
                data: {
                    player,
                    roundId,
                    campaignType,
                    campaignData,
                    campaigns,
                },
            });
        }
        const {type, tool, campaignId, end, config} = activeCampaign;

        if (!tool.play) {
            logger.error(`Campaign ${campaignType} needs to implement the play method to process play requests`, {
                player,
                campaignId,
                campaignData,
            });
            continue;
        }

        if (end && end.getTime() < Date.now()) {
            logger.error(`Campaign ${campaignType} has ended but play was requested`, {
                player,
                campaignId,
                campaignData,
            });
            continue;
        }

        await getConnection("primary").transaction(async manager => {
            const playRequest = {roundId, step, data: campaignData};
            const request: any = {config, player, roundId, playRequest, ...lazyLoadState(manager, campaignId, playerId)};

            if (tool.accumulator) {
                request.streamEntry = (dataSupplier: (sequence: number) => any) => streamEntry(campaignId, dataSupplier);
                request.streamSynchronizedAccumulator = <TConfig, TEntryData, TAccumulatorData>(accumulator: IStreamAccumulator<TConfig, TEntryData, TAccumulatorData>) =>
                    accumulateStreamSynchronously<TConfig, TEntryData, TAccumulatorData>(type, campaignId, accumulator);
            }

            const result: any = (await tool.play!(request)) || {};
            await saveState(manager, campaignId, playerId, result.campaignState, result.playerState);

            if (result.data) {
                response[type] = result.data;
                logger.info("Result data appended", {data: response.data});
            }
        });
    }

    return response;
}

export async function insertLogs(manager: EntityManager, campaignId: string, logs: ILog[]) {
    await manager.insert(
        CampaignLog,
        logs.map(log => ({...log, campaignId})),
    );
}
