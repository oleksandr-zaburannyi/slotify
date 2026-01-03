import {body, query} from "express-validator";
import {hmac} from "@slotify/shared/lib/middleware/hmac";
import {validate} from "@slotify/shared/lib/middleware/validate";
import proxy from "../route/proxy";
import {IRgsAdapter} from "./IRgsAdapter";
import {ITransaction, IWalletBalance} from "../walletAdapter/IWalletAdapter";
import {Transaction} from "../db/model/Transaction";
import Exception from "@slotify/shared/lib/Exception";
import {URLSearchParams} from "url";
import {Game} from "../db/model/Game";
import {getRoundId} from "../util/ids";
import * as crypto from "crypto";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {cancelCampaign, createCampaign, getAvailableBetsBulk, getCampaignByName} from "../util/external";

interface IConfig {
    secretKey: string;
    realUrl?: string;
    funUrl?: string;
    replayUrl?: string;
    freeBetsUrl?: string;
}

const getLaunchUrl = (mode: string, config: IConfig): string | undefined => {
    switch (mode) {
        case "real":
            return config.realUrl;
        case "fun":
            return config.funUrl;
        case "replay":
            return config.replayUrl;
        default:
            throw new Exception("RGS url mode not supported", {data: {mode}});
    }
};

const adapter: IRgsAdapter<IConfig> = {
    init: function init(rgs, api, basePath, config) {
        if (!config.secretKey) {
            throw new Error(`Secret key not specified for ${basePath}`);
        }

        api.post(
            basePath + "/authenticate",
            hmac(config.secretKey),
            validate([
                body("wallet").isString().exists().isLength({max: 255}),
                body("operator").isString().exists().isLength({max: 255}),
                body("key")
                    .isString()
                    .exists()
                    .isLength({max: 10 * 1024}),
                body("provider").isString().exists().isLength({max: 255}),
                body("game").isString().optional().isLength({max: 255}),
                body("ip").optional({nullable: true}).isString(),
                body("channel").optional({nullable: true}).isString(),
            ]),
            async (req, res) => {
                const {wallet, operator, key, game, provider, ip, channel} = req.body;
                const ipCountry = req.get("X-IP-Country");
                const ipRegion = req.get("X-IP-Region");
                res.json(await proxy.authenticate(wallet, operator, key, provider, await Game.fromRgs(rgs, game), ip, ipCountry, ipRegion, channel));
            },
        );

        api.put(
            basePath + "/transaction",
            hmac(config.secretKey),
            validate([
                body("playerId").isString().exists().isUUID(4),
                body("rgsTransactionId").isString().exists().isLength({max: 255}),
                body("type").isString().exists().isLength({max: 255}),
                body("amount").isFloat().exists(),
                body("jackpotAmount").isFloat().optional(),
                body("provider").isString().optional().isLength({max: 255}),
                body("game").isString().optional({nullable: true}).isLength({max: 255}),
                body("variant").isString().optional({nullable: true}).isLength({max: 255}),
                body("channel").isString().optional({nullable: true}).isLength({max: 255}),
                body("roundId").isString().exists().isLength({max: 255}),
                body("category").isString().optional().isLength({max: 255}),
                body("name").isString().optional().isLength({max: 255}),
                body("campaignType").isString().optional().isLength({max: 255}),
                body("campaignId").isString().optional().isLength({max: 255}),
                body("walletCampaignId").isString().optional().isLength({max: 255}),
                body("campaignData").optional({nullable: true}).isObject(),
                body("roundFinished").isBoolean().optional(),
                body("winRatio").optional({nullable: true}).isFloat(),
                body("ip").optional({nullable: true}).isString(),
                body("auto").optional({nullable: true}).isBoolean(),
                body("regulatory").optional({nullable: true}).isObject(),
            ]),
            async (req, res) => {
                const {
                    rgsTransactionId,
                    playerId,
                    type,
                    amount,
                    jackpotAmount,
                    provider,
                    game,
                    variant,
                    roundId,
                    category,
                    name,
                    campaignType,
                    campaignId,
                    walletCampaignId,
                    campaignData,
                    roundFinished,
                    channel,
                    winRatio,
                    ip,
                    auto = false,
                    regulatory,
                } = req.body;
                const transaction: ITransaction = {
                    rgs,
                    provider,
                    type,
                    amount,
                    jackpotAmount,
                    game: await Game.fromRgs(rgs, game),
                    rgsRoundId: roundId,
                    roundId: await getRoundId(rgs, roundId),
                    category,
                    name,
                    campaignType,
                    campaignId,
                    walletCampaignId,
                    campaignData,
                    roundFinished,
                    winRatio,
                    playerId,
                    rgsTransactionId,
                    channel,
                    variant,
                    ip,
                    auto,
                    regulatory,
                };
                res.json(await proxy.transaction(transaction));
            },
        );

        api.get(
            basePath + "/balance",
            hmac(config.secretKey),
            validate([query("playerId").isUUID(4).exists(), query("provider").isString().exists().isLength({max: 255}), query("game").isString().isLength({max: 255}).exists()]),
            async (req, res) => {
                const {playerId, provider, game} = req.query as Record<string, string>;
                res.json(await proxy.balance(playerId, provider, await Game.fromRgs(rgs, game)));
            },
        );

        api.delete(
            basePath + "/cancel",
            hmac(config.secretKey),
            validate([body("roundId").isString().optional({nullable: true}).isLength({max: 255}), body("rgsTransactionId").isString().optional({nullable: true}).isLength({max: 255}), body("auto").optional({nullable: true}).isBoolean()]),
            async (req, res) => {
                const {rgsTransactionId, roundId, auto} = req.body;
                if (roundId) {
                    let balance: IWalletBalance = {balance: 0};
                    const transactions = await Transaction.findBy({roundId: await getRoundId(rgs, roundId), type: "withdraw"});
                    for (const {rgsTransactionId} of transactions) {
                        balance = await proxy.cancel(rgs, rgsTransactionId, auto);
                    }
                    res.json(balance);
                } else if (rgsTransactionId) {
                    res.json(await proxy.cancel(rgs, rgsTransactionId, auto));
                } else {
                    throw new Exception("RoundId or rgsTransactionId should be specified", {data: {roundId, rgsTransactionId, auto}});
                }
            },
        );

        api.post(
            basePath + "/message",
            hmac(config.secretKey),
            validate([body("playerId").isUUID(4).exists(), body("provider").isString().exists().isLength({max: 255}), body("game").isString().isLength({max: 255}).exists(), body("data").isObject().exists()]),
            async (req, res) => {
                const {playerId, provider, game, data} = req.body;
                res.json(await proxy.message(playerId, provider, await Game.fromRgs(rgs, game), data));
            },
        );
    },
    launch: async (mode, config, params, req) => {
        let url = getLaunchUrl(mode, config);

        if (url === undefined) {
            throw new Exception("Url not defined", {data: {mode, params, config}});
        }
        if (params.game) params.game = await Game.toRgs(params.game);

        if (url.includes("${hostname}")) {
            const hostname = req ? req.hostname : new URL(process.env.URL!).hostname;
            url = url.replace(/\$\{hostname}/g, params.hostname || hostname);
        }

        for (const key in params) {
            if (url.includes("${" + key + "}")) {
                url = url.replace(new RegExp("\\${" + key + "}", "g"), encodeURIComponent(params[key]));
                delete params[key];
            }
        }
        //replace remaining variables
        url = url.replace(new RegExp("\\${[^}]+}", "g"), "");

        const [baseUrl, search] = url.split("?");
        const urlParams = new URLSearchParams(search);

        for (const param in params) {
            if (!urlParams.has(param)) {
                urlParams.set(param, params[param]);
            }
        }

        return `${baseUrl}?${urlParams.toString()}`;
    },

    addFreeBets: async (request, config, wallet) => {
        if (config.freeBetsUrl) {
            const body = JSON.stringify(request);
            const headers = {
                "Content-Type": "application/json",
                "X-Server-Authorization": crypto.createHmac("sha256", config.secretKey).update(body).digest("hex"),
            };
            return await fetchAndParse(config.freeBetsUrl + "/freeBets/add", {method: "POST", body, headers, timeout: 45 * 1000}, 0);
        }

        const {walletCampaignId, bets, amount, currency, ...reminder} = request;
        await createCampaign({
            wallets: [wallet],
            walletCampaignId,
            name: wallet + "_" + walletCampaignId,
            type: "freeBets",
            config: {bets, amount, currency},
            ...reminder,
        });

        return {success: true};
    },

    removeFreeBets: async (walletCampaignId: string, config, wallet) => {
        if (config.freeBetsUrl) {
            const body = JSON.stringify({walletCampaignId});
            const headers = {
                "Content-Type": "application/json",
                "X-Server-Authorization": crypto.createHmac("sha256", config.secretKey).update(body).digest("hex"),
            };
            return await fetchAndParse(config.freeBetsUrl + "/freeBets/remove", {method: "POST", body, headers, timeout: 45 * 1000}, 0);
        }

        const campaign = await getCampaignByName(wallet + "_" + walletCampaignId);
        await cancelCampaign(campaign!.campaignId!);
        return {success: true};
    },

    availableBets: async ({games, currencies}, config, wallet) => {
        if (config.freeBetsUrl) {
            const body = JSON.stringify({games, currencies});
            const headers = {
                "Content-Type": "application/json",
                "X-Server-Authorization": crypto.createHmac("sha256", config.secretKey).update(body).digest("hex"),
            };
            return await fetchAndParse(config.freeBetsUrl + "/freeBets/availableBets", {method: "POST", body, headers, timeout: 45 * 1000}, 0);
        }

        return getAvailableBetsBulk({wallet, games, currencies});
    },
};
export default adapter;
