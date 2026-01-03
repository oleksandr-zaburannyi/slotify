import {Rgs} from "../db/model/Rgs";
import {getRgsAdapter} from "../rgsAdapter/rgsAdapter";
import {Game} from "../db/model/Game";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {Request} from "express";

export type IParamsReal = {
    wallet: string;
    key: string;
    operator: string;
    game: string;
    language?: string;
    lobbyUrl?: string;
    depositUrl?: string;
    realityCheckInterval?: string;
    realityCheckElapsed?: string;
    realityCheckContinueUrl?: string;
    historyUrl?: string;
    refreshUrl?: string;
    startAutoplayUrl?: string;
    customExit?: string;
    channel?: string;
    theme?: string;
};

export type IParamsFun = {
    operator: string;
    game: string;
    language?: string;
    lobbyUrl?: string;
    depositUrl?: string;
    channel?: string;
    theme?: string;
};

export type IParamsReplay = {
    roundId: string;
    operator: string;
    game: string;
    language?: string;
    lobbyUrl?: string;
    depositUrl?: string;
    channel?: string;
    theme?: string;
};

export default async function launch(mode: "real" | "fun" | "replay", params: IParamsReal | IParamsFun | IParamsReplay, req?: Request<any, any, any, any>) {
    const {rgs, provider, rgsConfig} = await Game.get(params.game);
    const {adapter, config} = await Rgs.getById(rgs);
    const launchConfig = Object.assign({}, config, rgsConfig || {});
    return await getRgsAdapter(adapter).launch(mode, launchConfig, clearEmpty({...params, rgs, provider}), req);
}
