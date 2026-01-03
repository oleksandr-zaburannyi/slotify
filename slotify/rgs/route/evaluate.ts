import {Wager} from "../db/model/Wager";
import {Round} from "../db/model/Round";
import {Command} from "../db/model/Command";
import Exception from "@slotify/shared/lib/Exception";
import {Draw} from "../db/model/Draw";
import {Room} from "../db/model/Room";
import {DrawWin} from "../db/model/DrawWin";
import {isBaseBet, maxWin, winRatio} from "../util/roundUtil";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {gamesService} from "../util/gamesUtil";

export default async function evaluate(type: string | null, data: any, roundId: string) {
    const round = await Round.findOneBy({roundId});
    if (round) {
        //single player
        const wagers = await Wager.find({where: {roundId}, order: {createdAt: "ASC"}});
        if (wagers.length === 0) throw new Exception("Couldn't find associated wager", {data: {roundId}});

        const {provider, game, variant} = round;

        switch (type) {
            case "isBaseBet":
                return {isBaseBet: await isBaseBet(provider, game, variant, wagers[0].action)};
            case "winRatio":
                const bet = wagers[0].bet!;
                const win = wagers.reduce((prev, wager) => prev + (wager.win || 0), 0);
                return {winRatio: await winRatio(provider, game, variant, wagers[0].action, bet, win), bet, win};
            case "maxWin":
                return {maxWin: maxWin(provider, game, variant, wagers[0].action)};
            default:
                const mappedWagers = wagers.map(({bet, win, action, data, next, state, params}) => ({bet, win, action, data, next, state, params}));
                return evaluateRequest(round.provider!, round.game, type, data, {wagers: mappedWagers});
        }
    }

    const command = await Command.findOneBy({roundId});
    if (command) {
        //multi-player
        const draw = await Draw.findOneByOrFail({drawId: command.drawId});
        const room = await Room.findOneByOrFail({roomId: draw.roomId});
        const drawWin = await DrawWin.findOneByOrFail({drawId: command.drawId, roundId});

        const {provider, game} = room;

        switch (type) {
            case "isBaseBet":
                return {isBaseBet: await isBaseBet(provider, game, undefined, command.action)};
            case "winRatio":
                const bet = command.bet;
                const win = drawWin.amount;
                return {winRatio: await winRatio(provider, game, undefined, command.action, bet!, win), win, bet};
            case "maxWin":
                return {maxWin: maxWin(provider!, game, undefined, command.action)};
            default:
                return evaluateRequest(provider, game, type, data, {draw: {state: draw.state}});
        }
    }

    throw new Exception("Spefified 'roundId' doesn't exist", {data: {roundId}});
}

async function evaluateRequest(provider: string, game: string, type: string | null, data: any, payload: any) {
    return await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/evaluate`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({type, data, ...payload}),
    });
}
