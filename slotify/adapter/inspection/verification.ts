import {ITransaction} from "../walletAdapter/IWalletAdapter";
import * as process from "process";
import {DateTime} from "../util/luxon";
import {Player} from "../db/model/Player";
import {Transaction} from "../db/model/Transaction";
import {RoundVerificationCache} from "../db/model/RoundVerificationCache";
import {IRoundVerificationAction, IRoundVerificationCheck, IRoundVerificationDetails, RoundVerification} from "../db/model/RoundVerification";
import {Wallet} from "../db/model/Wallet";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import currencies from "../route/currencies";
import cache, {invalidate} from "@slotify/shared/lib/cache";
import Exception from "@slotify/shared/lib/Exception";
import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {IFilter} from "@slotify/shared/lib/graphQLApi";
import {gameWin} from "../route/report";
import {sendAlert} from "@slotify/shared/lib/sendAlert";
import {getServiceUrl} from "@slotify/shared/lib/urls";
import {redis} from "@slotify/shared/lib/redis";
import logger from "@slotify/shared/lib/logger";

const getCurrencies = cache(10 * 60, currencies, ["currencyRates"]);

const transactionAlertText = (roundId: string, score: number) => `
    Round verification score: ${score} points<br/>
    <a href="${process.env.URL}/backoffice/rounds/${roundId}">Open in Back office</a> <br/>
`;

const transactionRejectedText = (roundId: string, score: number) => `
    Round verification score: ${score} points - transaction rejected<br/>
    <a href="${process.env.URL}/backoffice/rounds/${roundId}">Open in Back office</a> <br/>
`;

const walletBlockedText = (player: Player, roundId: string) => `
    We detected suspicious activity on wallet ${player.wallet}.<br/>
    Please freeze their withdrawals until the situation is fully explained. Please investigate for potential other anomalies.<br/>
    Wallet '${player.wallet}' has been blocked.<br/>
    <a href="${process.env.URL}/backoffice/rounds/${roundId}">Open in Back office</a> <br/>
`;

const playerBlockedText = (player: Player, roundId: string) => `
    We detected suspicious activity on a player (playerId: ${player.id}, nativeId: ${player.nativeId}) from wallet ${player.wallet}.<br/>
    Please freeze their withdrawals until the situation is fully explained. Please investigate for potential other anomalies.<br/>
    Player has been blocked.<br/>
    <a href="${process.env.URL}/backoffice/rounds/${roundId}">Open in Back office</a> <br/>
`;

type IPlayerCache = {
    dailyHistory: {
        bet: number;
        win: number;
        netWinsOver10k: number;
        topWins: number[];
    }[];
    winAmounts: number[];
    winRatios: number[];
};

async function getPlayerCache(transaction: ITransaction, transactions: Transaction[], player: Player, totalBet: number, totalWin: number): Promise<IPlayerCache> {
    let cache: IPlayerCache | null = null;

    await getConnection("primary").transaction(async manager => {
        const key = "player_" + player.id;
        const monitoring = await manager.findOne(RoundVerificationCache, {where: {key}, lock: {mode: "pessimistic_write"}});

        //WIN AMOUNTS
        let winAmounts = monitoring?.value.winAmounts || [];
        winAmounts.push(transaction.amount);
        winAmounts = winAmounts.slice(-3);

        //WIN RATIOS
        let winRatios = monitoring?.value.winRatios || [];
        winRatios.push(totalWin / totalBet);
        winRatios = winRatios.slice(-100);

        //GAME WIN PER DAY
        const dailyHistory = monitoring?.value.dailyHistory || {};
        const currentDay = Math.floor(new Date().getTime() / 1000 / 60 / 60 / 24);
        dailyHistory[currentDay] ||= {bet: 0, win: 0, netWinsOver10k: 0};
        dailyHistory[currentDay].bet += totalBet;
        dailyHistory[currentDay].win += totalWin;
        dailyHistory[currentDay].topWins = [...(dailyHistory[currentDay].topWins || []), totalWin].sort((a, b) => a - b).slice(-3);
        if (totalWin - totalBet > 10 * 1000) dailyHistory[currentDay].netWinsOver10k++;

        const maxDaysAgo = 100;
        while (parseInt(Object.keys(dailyHistory)[0], 10) < currentDay - maxDaysAgo) {
            delete dailyHistory[Object.keys(dailyHistory)[0]];
        }

        const value: IPlayerCache = {dailyHistory, winAmounts, winRatios};
        if (monitoring) {
            manager.update(RoundVerificationCache, {key}, {value}).catch(() => null);
        } else {
            manager.insert(RoundVerificationCache, {key, value}).catch(() => null);
        }
        cache = value;
    });

    return cache!;
}

type IWalletCache = {
    hourlyHistory: Record<
        string,
        {
            bet: number;
            win: number;
        }
    >;
};

const defaultWalletInspectionExpiryTime = 2 * 24 * 60 * 60 * 1000; // two days
const getWalletCache = cache(
    2 * 60,
    async (wallet: string): Promise<IWalletCache> => {
        const redisCacheKey = `inspection-wallet-cache-${wallet}`;
        const redisCache = await redis.get(redisCacheKey);
        if (redisCache) return JSON.parse(redisCache);

        const resetTime = Number((await redis.get(`inspection-wallet-cache-reset-time-${wallet}`)) || 0);
        const twoDaysAgoTime = Date.now() - defaultWalletInspectionExpiryTime;
        const startTime = Math.max(resetTime, twoDaysAgoTime);

        const cache: IWalletCache | null = {hourlyHistory: {}};

        const filter: IFilter[] = [
            {field: "date", type: "GREATER_OR_EQUAL", value: DateTime.fromMillis(startTime).toFormat("yyyy-MM-dd HH:mm")},
            {field: "wallet", type: "EQUAL", value: wallet},
            {field: "excluded", type: "NOT_EQUAL", value: true},
        ];
        const {items} = await gameWin(undefined, filter, 100, 0, {}, {convert: true, dimensions: ["wallet"], interval: "hour"});
        for (const hourlyGameWin of items) {
            cache.hourlyHistory[new Date(hourlyGameWin.hour).getTime() / 1000 / 60 / 60] = {bet: parseFloat(hourlyGameWin.totalBet), win: parseFloat(hourlyGameWin.totalWin)};
        }

        await redis.set(redisCacheKey, JSON.stringify(cache), {EX: 5 * 60});
        return cache!;
    },
    ["walletInspectionCache"],
);

export async function resetWalletCache(wallet: string) {
    logger.info(`Resetting wallet ${wallet} inspection cache`);
    await redis.del(`inspection-wallet-cache-${wallet}`);
    await redis.set(`inspection-wallet-cache-reset-time-${wallet}`, Date.now(), {EX: defaultWalletInspectionExpiryTime});
    invalidate("walletInspectionCache");
}

type IRule = {
    operator: ">" | ">=" | "<" | "<=" | "=";
    value: number;
    points: number;
};

type IConfig = {
    alertedThreshold: number;
    rejectedThreshold: number;
    maxPlayerRejectedTransactions: number;
    maxWalletRejectedTransactions: number;
    rules?: {
        playerRegistration: IRule[];
        transactionOffset: IRule[];
        consecutiveWinsWithSameAmount: IRule[];
        winFrequencyShortTerm: IRule[];
        playerRTPLongTerm: IRule[];
        playerGameWinMediumTerm: IRule[];
        playerShortTermNormalizedRTP: IRule[];
        winAmount: IRule[];
        numberOfLargetNetWins: IRule[];
        maxWinRatio: IRule[];
        walletGameWinShortTerm: IRule[];
    };
};

function runRules(rules: IRule[] = [], actual: number, description: string, checks: IRoundVerificationCheck[]) {
    for (const {operator, value, points} of rules) {
        switch (operator) {
            case "<":
                if (actual < value) return checks.push({points, description});
                break;
            case "<=":
                if (actual <= value) return checks.push({points, description});
                break;
            case ">":
                if (actual > value) return checks.push({points, description});
                break;
            case ">=":
                if (actual >= value) return checks.push({points, description});
                break;
            case "=":
                if (actual == value) return checks.push({points, description});
                break;
            default:
                throw new Exception("Inspection rule operator not recognised");
        }
    }
}

export async function verification(config: IConfig, transaction: ITransaction, transactions: Transaction[], player: Player, isPlayerExcluded: boolean) {
    if (!transaction.roundFinished) return;
    if (transaction.type !== "deposit") return;
    if (transaction.category === "promo") return;
    if (isPlayerExcluded) return;

    const rate = (await getCurrencies()).currencies.find(item => item.currency === player.currency)?.rate ?? 1;
    const totalBet = rate === 0 ? 0 : transactions.filter(t => t.type === "withdraw").reduce((prev, current) => prev + current.amount, 0) / rate;
    const totalWin = rate === 0 ? 0 : transactions.filter(t => t.type === "deposit").reduce((prev, current) => prev + current.amount, 0) / rate;

    const playerCache = await getPlayerCache(transaction, transactions, player, totalBet, totalWin);

    if (totalBet >= totalWin) return;

    const checks: IRoundVerificationCheck[] = [];

    //PLAYER REGISTRATION
    const hoursSincePlayerRegistration = (Date.now() - player.createdAt.getTime()) / 1000 / 60 / 60;
    runRules(config.rules?.playerRegistration, hoursSincePlayerRegistration, `Player's registration date was ${Math.floor(hoursSincePlayerRegistration)} hours ago`, checks);

    //TIME OFFSET SINCE LAST TRANSACTION
    if (transactions.length >= 2 && !transaction.auto) {
        const transactionOffset = transactions[transactions.length - 1].createdAt.getTime() - transactions[transactions.length - 2].createdAt.getTime();
        runRules(config.rules?.transactionOffset, transactionOffset, `Transaction has been done in ${Math.round(transactionOffset)}ms after previous one`, checks);
    }

    //CONSECUTIVE WINS WITH EQUAL AMOUNT
    let consecutiveWinsWithSameAmount = 1;
    let i = playerCache.winAmounts.length || 0;
    while (i > 1 && playerCache.winAmounts[i - 1] === playerCache.winAmounts[i - 2]) {
        consecutiveWinsWithSameAmount++;
        i--;
    }
    runRules(config.rules?.consecutiveWinsWithSameAmount, consecutiveWinsWithSameAmount, `${consecutiveWinsWithSameAmount} consecutive wins with the same amount`, checks);

    // WIN FREQUENCY IN THE LAST 25 ROUNDS
    const rounds = 25;
    if (playerCache.winRatios.length >= rounds) {
        const winFrequency = playerCache.winRatios.slice(-rounds).filter(winRatio => winRatio > 1).length / rounds;
        runRules(config.rules?.winFrequencyShortTerm, winFrequency, `Win frequency in last 25 rounds was ${(winFrequency * 100).toFixed(2)}%`, checks);
    }

    //LONG TERM RTP
    const last90days = Object.values(playerCache.dailyHistory).slice(-90);
    const longTermRTP = last90days.reduce((sum, {win}) => sum + win, 0) / last90days.reduce((sum, {bet}) => sum + bet, 0);
    runRules(config.rules?.playerRTPLongTerm, longTermRTP, `Player's RTP over last 90 days was ${(longTermRTP * 100).toFixed(2)}%`, checks);

    //MEDIUM TERM GAME WIN IN THE LAST 7 DAYS
    const player7daysHistory = Object.values(playerCache.dailyHistory).slice(-7);
    const top3PlayerWins = player7daysHistory
        .reduce((allTopWins: number[], {topWins}) => [...allTopWins, ...(topWins || [])], [])
        .sort((a, b) => a - b)
        .slice(-3);
    const sumOfTop3PlayerWins = top3PlayerWins.reduce((a, b) => a + b, 0);
    const playerGw = player7daysHistory.reduce((sum, {bet, win}) => sum + bet - win, 0) + sumOfTop3PlayerWins;
    runRules(config.rules?.playerGameWinMediumTerm, playerGw, `Player's Game Win over last 7 days excluding top 3 wins was ${playerGw.toFixed(2)} ${process.env.BASE_CURRENCY}`, checks);

    //SHORT TERM NORMALIZED RTP EXCLUDING TOP 2 WINS
    const numberOfRounds = 100;
    let winRatios = playerCache.winRatios.slice(-numberOfRounds);
    if (winRatios.length >= numberOfRounds) {
        winRatios = winRatios.sort((a, b) => b - a).slice(-winRatios.length + 2);
        const shortTermRTP = winRatios.reduce((sum, current) => sum + current, 0) / winRatios.length;
        runRules(config.rules?.playerShortTermNormalizedRTP, shortTermRTP, `Player's normalized RTP over last 100 rounds excluding top 2 wins was ${(shortTermRTP * 100).toFixed(2)}%`, checks);
    }

    //WIN AMOUNT
    runRules(config.rules?.winAmount, totalWin, `Win amount was ${totalWin.toFixed(2)} ${process.env.BASE_CURRENCY}`, checks);

    //NET WINS OVER 10k
    const numberOfNetWinsOver10kInLast2Days = Object.values(playerCache.dailyHistory)
        .slice(-2)
        .reduce((sum, {netWinsOver10k}) => sum + netWinsOver10k, 0);
    runRules(config.rules?.numberOfLargetNetWins, numberOfNetWinsOver10kInLast2Days, `${numberOfNetWinsOver10kInLast2Days} net wins (win-bet) over €10k in last 2 days`, checks);

    //MAX WIN
    if (transaction.winRatio !== undefined && transaction.winRatio > 1000) {
        //to avoid unnecessary calls, we check max win only for the wins over x1k
        try {
            const {maxWin} = await fetchAndParse(`${getServiceUrl("rgs")}/api/evaluate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({roundId: transaction.roundId, type: "maxWin"})});
            const winRatioToInitialBet = Math.floor(totalWin / totalBet) / maxWin;
            runRules(config.rules?.maxWinRatio, winRatioToInitialBet, `Win was ${(winRatioToInitialBet * 100).toFixed(2)}% of theoretical max win of the game`, checks);
        } catch {
            //couldn't calculate max win
        }
    }

    //WALLET SHORT TERM GW
    if (config.rules?.walletGameWinShortTerm && config.rules?.walletGameWinShortTerm.length > 0) {
        const walletCache = await getWalletCache(player.wallet);
        const wallet24hours = Object.values(walletCache.hourlyHistory).slice(-24);
        const walletGw = wallet24hours.reduce((sum, {bet, win}) => sum + bet - win, 0);
        runRules(config.rules?.walletGameWinShortTerm, walletGw, `Wallet Game Win in last 24 hours was ${walletGw.toFixed(2)} ${process.env.BASE_CURRENCY}`, checks);
    }

    ///// ANALYSING SCORE

    const score = checks.reduce((sum, {points}) => sum + points, 0);
    const details: IRoundVerificationDetails = {checks};
    let action: IRoundVerificationAction = "passed";
    if (config.alertedThreshold != null && score >= config.alertedThreshold) action = "alerted";
    if (config.rejectedThreshold != null && score >= config.rejectedThreshold) action = "rejected";

    await RoundVerification.insert({roundId: transaction.roundId, score, details, action});

    if (action === "alerted") {
        sendAlert("Transaction alert", transactionAlertText(transaction.roundId, score));
    } else if (action === "rejected") {
        sendAlert("Transaction rejected", transactionRejectedText(transaction.roundId, score));

        const rejectedTransactions = await Transaction.find({where: {status: "rejected", type: "deposit"}, relations: ["player"]});
        const playerRejectedTransactions = rejectedTransactions.filter(t => t.player.id === player.id).length;
        const walletRejectedTransactions = rejectedTransactions.filter(t => t.player.wallet === player.wallet).length;

        if (config.maxPlayerRejectedTransactions != null && playerRejectedTransactions + 1 >= config.maxPlayerRejectedTransactions) {
            await Player.update({id: player.id}, {blocked: true});
            await RoundVerificationCache.delete({key: "player_" + player.id});
            sendAlert(`Player blocked due to suspicious activity`, playerBlockedText(player, transaction.roundId), true);
        } else if (config.maxWalletRejectedTransactions != null && walletRejectedTransactions + 1 >= config.maxWalletRejectedTransactions) {
            await Wallet.update({id: player.wallet}, {enabled: false});
            await RoundVerificationCache.delete({key: "wallet_" + player.wallet});
            sendAlert(`Wallet blocked due to suspicious activity`, walletBlockedText(player, transaction.roundId), true);
        }

        throw new Exception("Transaction verification failed");
    }
}
