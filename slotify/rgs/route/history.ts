import {Wager} from "../db/model/Wager";
import {Round} from "../db/model/Round";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {DrawWin} from "../db/model/DrawWin";
import {Room} from "../db/model/Room";
import {Command} from "../db/model/Command";

export default async function history(
    page: number,
    provider: string,
    game: string,
    playerId: string,
): Promise<{hasNext: boolean; hasPrev: boolean; data: {roundId: string; bet: number; win: number; balanceBefore: number; balanceAfter?: number; createdAt: Date}[]}> {
    const limit = 10;
    const rounds = await getConnection("replica")
        .createQueryBuilder(Round, "rgs_round")
        .select(['rgs_round.createdAt as "createdAt"', 'rgs_round.roundId as "roundId"', "sum(win) as win", "sum(bet) as bet"])
        .leftJoin(Wager, "rgs_wager", "rgs_round.roundId = rgs_wager.roundId")
        .groupBy("rgs_round.roundId")
        .addGroupBy("rgs_round.createdAt")
        .where("rgs_round.playerId = :playerId", {playerId})
        .andWhere("rgs_round.game = :game", {game})
        .andWhere("rgs_round.provider = :provider", {provider})
        .andWhere("rgs_round.status = :status", {status: "finished"})
        .orderBy({'rgs_round."createdAt"': "DESC"})
        .limit(limit + 1)
        .offset(Math.max(page, 0) * limit)
        .getRawMany();

    const draws = await getConnection("replica")
        .createQueryBuilder(Command, "rgs_command")
        .select(['rgs_command.createdAt as "createdAt"', 'rgs_command.roundId as "roundId"', "sum(bet) as bet", "sum(amount) as win", 'rgs_command.drawId as "drawId", rgs_room.name as "roomName"'])
        .leftJoin(DrawWin, "rgs_draw_win", "rgs_command.roundId = rgs_draw_win.roundId")
        .leftJoin(Room, "rgs_room", "rgs_command.roomId = rgs_room.roomId")
        .withDeleted()
        .groupBy("rgs_command.roundId")
        .addGroupBy("rgs_command.createdAt")
        .addGroupBy("rgs_command.drawId")
        .addGroupBy("rgs_room.name")
        .where("rgs_command.playerId = :playerId", {playerId})
        .andWhere("rgs_room.game = :game", {game})
        .andWhere("rgs_room.provider = :provider", {provider})
        .andWhere("rgs_command.bet IS NOT NULL")
        .andWhere("rgs_command.withdrawalStatus = 'finished'")
        .orderBy({'rgs_command."createdAt"': "DESC"})
        .limit(limit + 1)
        .offset(Math.max(page, 0) * limit)
        .getRawMany();

    const data = [...rounds, ...draws].sort((a, b) => b.createdAt - a.createdAt);
    const roundBalance = await getRoundBalance(data.map(item => item.roundId));

    return {
        hasPrev: page > 0,
        hasNext: data.length > limit,
        data: data
            .map(({createdAt, roundId, drawId, roomName, bet, win}) => ({
                createdAt,
                roundId,
                drawId,
                roomName,
                bet: parseFloat(bet),
                win: parseFloat(win),
                balanceBefore: roundBalance[roundId]?.balanceBefore,
                balanceAfter: roundBalance[roundId]?.balanceAfter,
            }))
            .splice(0, limit),
    };
}

export async function getRoundBalance(roundIds: string[]): Promise<Record<string, {balanceBefore: number; balanceAfter?: number}>> {
    const body = JSON.stringify({roundIds});
    const headers = {"Content-Type": "application/json"};
    const {roundBalance} = await fetchAndParse(`${getServiceUrl("adapter")}/api/roundBalance`, {method: "POST", body, headers, timeout: 45 * 1000}, 0);
    return roundBalance;
}
