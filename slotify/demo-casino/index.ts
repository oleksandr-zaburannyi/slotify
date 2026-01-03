import {createService, startService} from "@slotify/shared/lib/api";
import * as crypto from "crypto";
import {Express, NextFunction, Request, Response} from "express";
import countDecimals from "@slotify/shared/lib/countDecimals";
import {round} from "@slotify/shared/lib/round";
import {Player} from "./db/model/Player";
import {Transaction} from "./db/model/Transaction";
import {validate} from "@slotify/shared/lib/middleware/validate";
import {body} from "express-validator";
import dbOptions, {createConnections, getConnection} from "@slotify/shared/lib/dbOptions";
import {StatusCode} from "@slotify/shared/lib/StatusCode";
import {Server} from "http";
import wait from "@slotify/shared/lib/wait";
import {LessThan} from "typeorm";
import {v4} from "uuid";

const secretKey = process.env.SECRET_KEY || "secret-demo";
const baseCurrency = process.env.BASE_CURRENCY!;

const errors = {
    PLAYER_UNAUTHORIZED: "PLAYER_UNAUTHORIZED",
    SERVER_UNAUTHORIZED: "SERVER_UNAUTHORIZED",
    INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
    LOSS_LIMIT: "LOSS_LIMIT",
    UNKNOWN: "UNKNOWN",
};

function validateServer(req: Request, res: Response, next: NextFunction) {
    const bodyString = JSON.stringify(req.body ?? {});
    const checksum = crypto.createHmac("sha256", secretKey).update(bodyString).digest("hex");
    if (req.headers["x-server-authorization"] === checksum) {
        return next();
    }

    res.status(StatusCode.UNAUTHORIZED).json({error: {code: errors.SERVER_UNAUTHORIZED, message: "Couldn't authorize the server"}});
}

const requestDelay = process.env.REQUEST_DELAY ? parseInt(process.env.REQUEST_DELAY) : 0;

async function delay(req: Request, res: Response, next: NextFunction) {
    await wait(requestDelay);
    next();
}

async function validatePlayer(req: Request, res: Response, next: NextFunction) {
    const [, token] = (req.headers["authorization"] || "").split(" ");
    const player = await Player.findOneBy({token});
    if (player) {
        res.locals.player = player;
        return next();
    }
    res.status(StatusCode.UNAUTHORIZED).json({error: {code: errors.PLAYER_UNAUTHORIZED, message: "Couldn't authorize the player"}});
}

async function initApi(api: Express) {
    api.post("/authenticate", delay, validateServer, validate([body("operator").isString().exists().isLength({max: 255}), body("key").isString().exists()]), async function (req, res) {
        const {operator, key} = req.body;

        if (key === "non_existing_key") {
            //validate your token here, this is just an example
            res.status(StatusCode.BAD_REQUEST).send({error: {code: errors.PLAYER_UNAUTHORIZED, message: "Incorrect key"}});
            return;
        }

        //&key=player:100:usd:uk will create or update existing player with 100 usd and uk jurisdiction

        const demoPlayerCheat = key.split(":");
        const nativeId = demoPlayerCheat[0] || v4();

        const data = {
            nativeId,
            balance: parseFloat(demoPlayerCheat[1] || 10000),
            currency: demoPlayerCheat[2] || baseCurrency,
            jurisdiction: demoPlayerCheat[3] || "mt",
            country: demoPlayerCheat[4] || "uk",
            brand: demoPlayerCheat[5] || "demo",
            nickname: demoPlayerCheat[6] || undefined,
            gender: "m",
            operator,
            token: `token_${nativeId}`,
        };
        if (!(await Player.findOneBy({nativeId}))) {
            //if a player doesn't exist, create a new one
            await Player.create(data).save();
        } else if (demoPlayerCheat.length > 1) {
            //if a player exists, update it only if the "cheat" is passed. Don't change the currency as it would be rejected by the wallet
            const {currency, ...updateData} = data;
            await Player.update({nativeId}, updateData);
        }

        const player = await Player.findOneBy({nativeId});
        res.json(player);
    });

    api.post("/balance", delay, validateServer, validatePlayer, function (req, res) {
        const {player} = res.locals;
        res.json({balance: player.balance});
    });

    api.put(
        "/transaction",
        delay,
        validate([
            body("transactionId").isString().exists().isLength({max: 255}),
            body("roundId").isString().exists().isLength({max: 255}),
            body("roundFinished").isBoolean().optional({nullable: true}),
            body("amount").isFloat().exists(),
            body("type").isString().exists().isLength({max: 255}),
            body("campaignType").isString().optional().isLength({max: 255}),
        ]),
        validateServer,
        validatePlayer,
        async function (req, res) {
            const nativeId = res.locals.player.nativeId;

            const {amount, type, transactionId, campaignType, roundId, roundFinished} = req.body;
            const transaction = await Transaction.findOneBy({transactionId});
            if (!transaction) {
                if (await Transaction.findOneBy({roundId, roundFinished: true})) {
                    const error = {error: {code: errors.UNKNOWN, message: "Round was already finished"}};
                    res.status(StatusCode.BAD_REQUEST).json(error);
                    return;
                }
                await Transaction.insert({roundId, roundFinished, transactionId, type, amount});

                await getConnection("primary").transaction(async manager => {
                    const {balance} = await manager.findOneOrFail(Player, {where: {nativeId}, lock: {mode: "pessimistic_write"}});
                    const decimal = Math.max(countDecimals(balance), countDecimals(amount));
                    let newBalance = 0;
                    if (type === "deposit") {
                        newBalance = round(balance + amount, decimal);
                    } else if (type === "withdraw" && campaignType !== "freeBets") {
                        if (amount > balance) {
                            const error = {error: {code: errors.INSUFFICIENT_FUNDS, message: "Not enough money to make withdrawal"}};
                            res.status(StatusCode.BAD_REQUEST).json(error);
                            return;
                        }
                        newBalance = round(balance - amount, decimal);
                    } else {
                        newBalance = balance;
                    }
                    await manager.update(Player, {nativeId}, {balance: newBalance});
                    res.json({balance: newBalance});
                });
            } else {
                res.json({balance: res.locals.player.balance});
            }
        },
    );

    api.delete("/cancel", delay, validate([body("transactionId").isString().exists().isLength({max: 255})]), validateServer, validatePlayer, async function (req, res) {
        const {player} = res.locals;
        const {transactionId} = req.body;
        const transaction = await Transaction.findOneBy({transactionId});

        if (transaction && transaction.type === "withdraw" && !transaction.cancelled) {
            transaction.cancelled = true;
            await transaction.save();

            await getConnection("primary").transaction(async manager => {
                const {balance} = await manager.findOneOrFail(Player, {
                    where: {nativeId: player.nativeId},
                    lock: {mode: "pessimistic_write"},
                });

                const newBalance = round(balance + transaction.amount);
                await manager.update(Player, {nativeId: player.nativeId}, {balance: newBalance});
                player.balance = newBalance;
            });
        }

        res.json({balance: player.balance});
    });
}

async function clear() {
    const date = new Date();
    date.setHours(date.getHours() - 24 * 4);
    await Transaction.delete({updatedAt: LessThan(date)});
    await Player.delete({updatedAt: LessThan(date)});
}

async function init(): Promise<{api: Express; server: Server}> {
    const {api} = await createService("demo_casino");
    await createConnections({
        primary: {...dbOptions("demo_casino")},
    });
    await initApi(api);
    await clear();
    const server = await startService(api);
    return {api, server};
}

export default init();
