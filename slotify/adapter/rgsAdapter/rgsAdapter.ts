import Exception from "@slotify/shared/lib/Exception";
import {IRgsAdapter} from "./IRgsAdapter";
import standardRgsAdapter from "./standardRgsAdapter";
import {Express} from "express";
import {Rgs} from "../db/model/Rgs";
import {getIp} from "@slotify/shared/lib/ip";
import {checkIPWhitelisting} from "../util/ip";
import logger from "@slotify/shared/lib/logger";

const rgsAdapters: {[key: string]: IRgsAdapter} = {
    "standard": standardRgsAdapter,
};

export function getRgsAdapter(id: string): IRgsAdapter {
    const rgsAdapter = rgsAdapters[id];
    if (!rgsAdapter) throw new Exception(`Couldn't find RGS adapter '${id}'`);
    return rgsAdapter;
}

export async function initRgsApi(api: Express): Promise<void> {
    const rgss = await Rgs.getRgss();
    for (const {id, config, adapter, ips} of rgss) {
        try {
            const rgsAdapter = getRgsAdapter(adapter);
            api.all(`/rgs/${id}/*splat`, (req, res, next) => {
                const ip = getIp(req);
                if (ips && !checkIPWhitelisting(ip, ips)) {
                    throw new Exception("RGS IP not whitelisted", {data: {ip, ips, id, adapter}});
                }
                next();
            });
            rgsAdapter.init(id, api, "/rgs/" + id, config);
        } catch (e) {
            logger.warn("Error initializing RGS adapter", {id, adapter, error: e});
        }
    }
}
