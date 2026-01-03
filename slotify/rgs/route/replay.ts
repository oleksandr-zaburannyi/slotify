import {Round} from "../db/model/Round";
import info from "./info";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getRoundBalance} from "./history";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import Exception from "@slotify/shared/lib/Exception";
import {Command} from "../db/model/Command";
import {gamesService} from "../util/gamesUtil";
import {Draw} from "../db/model/Draw";
import {Room} from "../db/model/Room";
import {DrawWin} from "../db/model/DrawWin";
import {Currency} from "../db/model/Currency";
import {floor} from "@slotify/shared/lib/floor";
import {getPlayerDetails} from "../util/adapterUtil";
import {ISettingsFilter, Settings} from "../db/model/Settings";

export default async function replay(roundId: string) {
    const round = await Round.getWithWagers(roundId);
    if (round) {
        const {currency} = await getPlayerDetails(round.playerId);
        const {decimals} = await Currency.getFixedRate(currency, {});

        const win = round.wagers.reduce((sum: number, wager: any) => sum + wager.win, 0);
        const bet = round.wagers.reduce((sum: number, wager: any) => sum + wager.bet, 0);
        return {bet, win: floor(win, decimals), round: await Round.mapRoundToPlayer(round), ...(await replayData(roundId, round.playerId, round.provider!, round.game))};
    }

    const draw = await Draw.findOneBy({drawId: roundId, finished: true});
    if (draw) {
        const {state, roomId} = draw;
        const room = await Room.getByIdOrFail(roomId);
        const drawData = await fetchAndParse(`${await gamesService(room.provider, room.game)}/api/multiplayer/${room.game}/replay`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({state}),
        });

        return {draw: drawData};
    }

    const commands = await Command.findBy({roundId, withdrawalStatus: "finished"});
    if (commands.length > 0) {
        const {drawId, playerId, roomId, currency, createdAt} = commands[0];
        const {decimals} = await Currency.getFixedRate(currency!, {});

        const room = await Room.getByIdOrFail(roomId);
        const drawWins = await DrawWin.findBy({drawId, playerId, status: "finished"});
        const {state} = await Draw.findOneByOrFail({drawId, finished: true});
        const drawData = await fetchAndParse(`${await gamesService(room.provider, room.game)}/api/multiplayer/${room.game}/replay`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({state, playerId}),
        });

        const win = drawWins.reduce((sum: number, drawWin) => sum + drawWin.amount, 0);
        const bet = commands.reduce((sum: number, command) => sum + (command.bet || 0), 0);
        return {bet, win: floor(win, decimals), draw: drawData, createdAt, ...(await replayData(roundId, playerId, room.provider!, room.game))};
    }

    throw new Exception("Couldn't find roundId to replay", {data: {roundId}});
}

async function replayData(roundId: string, playerId: string, provider: string, game: string) {
    const {wallet, operator, brand, currency, jurisdiction} = await fetchAndParse(`${getServiceUrl("adapter")}/api/players/${playerId}`);
    const gameInfo = await info(provider!, game, playerId, currency, wallet, operator, brand, jurisdiction, undefined);
    const roundBalance = await getRoundBalance([roundId]);

    const {data: sessionData} = await fetchAndParse(`${getServiceUrl("adapter")}/api/sessions?roundId=${roundId}`);

    const {symbol: currencySymbol, decimals: currencyDecimals} = await Currency.getFixedRate(currency, {provider, game, wallet, operator, brand, currency, jurisdiction});
    const settingsFilter: ISettingsFilter = {wallet, operator, brand, currency, jurisdiction, game, provider};
    const currencyOrSymbol = (await Settings.useCurrencySymbol(settingsFilter)) ? currency : currencySymbol;

    return {currency: currencyOrSymbol, currencySymbol, currencyDecimals, ...gameInfo, balanceBefore: roundBalance[roundId].balanceBefore, balanceAfter: roundBalance[roundId].balanceAfter, sessionData};
}
