import logger from "@slotify/shared/lib/logger";
import {Player} from "../db/model/Player";
import {Transaction} from "../db/model/Transaction";
import {ITransaction, IWalletBalance, IWalletTransaction} from "../walletAdapter/IWalletAdapter";
import {getWalletAdapter} from "../walletAdapter/walletAdapter";
import Exception, {IExceptionPopup} from "@slotify/shared/lib/Exception";
import {authPromo, sendToPromo} from "./proxyPromo";
import {getSupportedCurrencies} from "../currencyFeed/currencyFeed";
import {Session} from "../db/model/Session";
import {futureAnthem} from "./futureAnthem";
import {Game} from "../db/model/Game";
import {inspection} from "../inspection/inspection";
import removeUnderscoredKeys from "@slotify/shared/lib/removeUnderscoredKeys";
import {getTransactionId} from "../util/ids";
import {Wallet} from "../db/model/Wallet";
import {isGeoIpBlocked, isIpBlocked} from "../util/ip";
import {scheduleTask, unsheduleTask} from "@slotify/shared/lib/scheduler";
import {executeInQueue} from "@slotify/shared/lib/queue";
import {serviceMetrics} from "../util/metrics";
import {ReportExclusion} from "../db/model/ReportExclusion";
import {isOneTimeKeyBlocked} from "../util/wallet";
import {round} from "@slotify/shared/lib/round";

const apiBlockedCountries = (process.env.API_BLOCKED_COUNTRIES || "")
    .split(",")
    .filter(country => !!country)
    .map(country => country.toLowerCase());

type IAuthenticate = {
    nativeId: string;
    playerId: string;
    balance: number;
    currency: string;
    brand?: string;
    country?: string;
    nickname?: string;
    gender?: string;
    jurisdiction?: string;
    sessionData?: any;
    sessionId: string;
    popups?: IExceptionPopup[];
};

async function getNormalisedAmount(roundId: string, amount: number): Promise<number | null> {
    const firstBet = await Transaction.findOne({where: {roundId}, order: {createdAt: "ASC"}});
    if (!firstBet && amount === 0) return null;
    if (firstBet && firstBet.amount === 0) return null;

    if (firstBet) return round(amount / firstBet.amount, 10);
    return 1;
}

export default {
    async authenticate(wallet: string, operator: string, key: string, provider: string, game: string, ip?: string, ipBlockHeader?: boolean, channel?: "desktop" | "mobile"): Promise<IAuthenticate> {
        const walletAdapter = await getWalletAdapter(wallet);
        try {
            logger.info("Authenticating player", {wallet, operator, key});

            const cachedSession = await Session.getCachedSession(key, provider, game, await Wallet.getKeyCacheExpiry(wallet));
            if (cachedSession) {
                const {nativeId, brand, currency, jurisdiction, country, nickname, gender} = await Player.getById(cachedSession.playerId);
                const {balance} = await this.balance(cachedSession.playerId, provider, game);
                logger.info(`Player authenticated ${cachedSession.playerId} (from cache)`);
                return {...cachedSession, nativeId, brand, currency, jurisdiction, country, nickname, gender, balance};
            }

            const {balance, token, sessionData, popups, campaignTypes, ...nativeUser} = await walletAdapter.authenticate(key, operator, provider, game, ip, channel);

            if (nativeUser.currency.toLowerCase() !== nativeUser.currency) throw new Exception("Player currency should be lowercase", {data: {...nativeUser}});
            if (nativeUser.country && apiBlockedCountries.includes(nativeUser.country.toLowerCase())) throw new Exception("Territory blocked (API country)", {code: "BLOCKED_TERRITORY", data: {...nativeUser}});
            if (await isIpBlocked(wallet, ipBlockHeader)) throw new Exception("Territory blocked (IP)", {code: "BLOCKED_TERRITORY", data: {...nativeUser}});
            if (await isGeoIpBlocked(wallet, ip)) throw new Exception("Territory blocked (Geo IP)", {code: "BLOCKED_TERRITORY", data: {...nativeUser}});
            if (await isOneTimeKeyBlocked(wallet, key)) throw new Exception("One-time key blocked", {code: "PLAYER_UNAUTHORIZED", data: {...nativeUser}});
            if (!(await getSupportedCurrencies()).includes(nativeUser.currency)) throw new Exception("Currency not supported", {data: {...nativeUser}, code: "CURRENCY_NOT_SUPPORTED"});

            const player = await Player.getOrCreate(nativeUser.nativeId, wallet, operator, nativeUser);
            if (player.blocked) throw new Exception("Player blocked", {code: "PLAYER_BLOCKED", data: {wallet, operator, key, player, nativeId: nativeUser.nativeId, nativeUser}});
            if (!(await Game.verify(game, wallet, operator, nativeUser.brand))) throw new Exception("Game not available", {data: {game}, code: "GAME_NOT_AVAILABLE"});

            const playerExclusion = await ReportExclusion.isPlayerExcluded(player.id);
            const {sessionId} = await Session.init(player.id, token, key, provider, game, sessionData, ip, playerExclusion.excluded);

            await authPromo({
                provider,
                game,
                wallet,
                operator,
                brand: nativeUser.brand,
                jurisdiction: nativeUser.jurisdiction,
                nativeId: nativeUser.nativeId,
                currency: player.currency,
                playerId: player.id,
                nickname: player.nickname,
                campaignTypes,
            });
            futureAnthem.authenticate(player, playerExclusion);

            logger.info(`Player authenticated ${player.id}`, {wallet, operator, key, player, nativeId: nativeUser.nativeId, nativeUser});
            return {...nativeUser, currency: player.currency, balance, playerId: player.id, sessionData: sessionData ? removeUnderscoredKeys(sessionData) : undefined, sessionId, popups};
        } catch (e) {
            logger.info(`Authentication failed (${(e as Error).message})`, {wallet, operator, error: e});
            throw e;
        }
    },
    async transaction(transaction: ITransaction): Promise<IWalletBalance & {promo: any}> {
        const playerId = transaction.playerId;
        const player = await Player.getById(playerId);
        const {wallet, nativeId, operator, brand, blocked, currency, jurisdiction, nickname} = player;
        if (blocked) throw new Exception("Player blocked", {code: "PLAYER_BLOCKED", data: {wallet, operator, playerId}});
        if (transaction.game && !(await Game.verify(transaction.game, wallet, operator, brand))) throw new Exception("Game not available", {code: "GAME_NOT_AVAILABLE"});

        const existingTransaction = await Transaction.findTransaction(transaction.rgs, transaction.rgsTransactionId);
        const transactionId = existingTransaction ? existingTransaction.id : getTransactionId(transaction.rgs, transaction.rgsTransactionId);

        let {
            campaignType,
            campaignId,
            campaignData,
            callFinished,
            jackpotAmount,
            data: promo,
        } = await sendToPromo(transaction.type, transaction.category, {
            transactionId,
            ...transaction,
            playerId,
            nativeId,
            wallet,
            operator,
            brand,
            currency,
            jurisdiction,
            nickname,
        });

        if (campaignType) transaction.campaignType = campaignType;
        if (campaignId) transaction.campaignId = campaignId;
        if (campaignData) transaction.campaignData = campaignData;
        if (jackpotAmount && transaction.jackpotAmount) throw new Exception("Can't overwrite jackpot amount");
        if (jackpotAmount) {
            transaction.jackpotAmount = jackpotAmount;
            // for withdrawal jackpotAmount is already included in amount
            // deposit requires appending it to the total amount
            if (transaction.type === "deposit") {
                transaction.amount += jackpotAmount;
            }
        }

        let createdAt = existingTransaction?.createdAt;

        const walletAdapter = await getWalletAdapter(wallet);
        const session = await Session.getAndProlong(player.id, transaction.provider, transaction.game, !transaction.auto, walletAdapter.sessionExpiryMinutes);
        if (!existingTransaction) {
            createdAt = await Transaction.start(transactionId, transaction, session.sessionId, await getNormalisedAmount(transaction.roundId, transaction.amount));
            try {
                await inspection(transactionId, transaction, player, session.isPlayerExcluded);
            } catch (e) {
                if (e instanceof Exception) {
                    await Transaction.rejected(transactionId, e.message);
                    throw new Exception(e.message, {code: "TRANSACTION_REJECTED", data: {transactionId, ...transaction, data: e.data}});
                } else {
                    throw e;
                }
            }
        }
        if (existingTransaction?.status === "finished" || existingTransaction?.status === "cancelled") {
            logger.info(`Returning existing transaction ${transactionId}`, {playerId, nativeId, wallet, operator, brand, transaction});
            const res = await sendToPromo(transaction.type + "Finished", transaction.category, {transactionId, ...transaction, playerId, nativeId, wallet, operator, brand, currency, jurisdiction, nickname});
            return {balance: existingTransaction.balanceAfter, promo: res.data};
        }
        if (existingTransaction?.status === "rejected") {
            logger.info(`Transaction already rejected ${transactionId}`, {playerId, nativeId, wallet, operator, brand, transaction});
            throw new Exception(existingTransaction.failReason || "Transaction rejected", {code: "TRANSACTION_REJECTED", data: {transactionId, ...transaction}});
        }

        try {
            logger.info(`Sending transaction ${transactionId}`, {playerId, nativeId, wallet, operator, brand, transaction});

            const startTime = new Date().getTime();
            const walletTransaction: IWalletTransaction = {transactionId, createdAt: createdAt!, ...transaction};
            const originalSession = existingTransaction?.sessionId ? await Session.get(existingTransaction.sessionId) : null;
            const {balance, popups} = await executeInQueue(await getParallelTransactionId(wallet, playerId), async () => await walletAdapter.transaction(player, walletTransaction, session, originalSession), 20, 60000);
            const responseTime = new Date().getTime() - startTime;

            if (callFinished) {
                const res = await sendToPromo(transaction.type + "Finished", transaction.category, {transactionId, ...transaction, playerId, nativeId, wallet, operator, brand, currency, jurisdiction, nickname});
                promo = res.data;
            }

            await Transaction.finish(transactionId, balance, transaction.auto);
            logger.info(`Transaction finished ${transactionId}`, {responseTime, playerId, nativeId, wallet, operator, brand, transaction, balance});
            serviceMetrics.updateFinishedTransactionCounter(transaction.game!, wallet, operator, brand);
            serviceMetrics.addTransactionLatencyToHistogram(responseTime, wallet);
            futureAnthem.transaction(existingTransaction || {...transaction, id: transactionId, createdAt: createdAt!}, balance);

            return {balance, popups, promo};
        } catch (e: any) {
            const code = e instanceof Exception && e.code ? e.code : "UNKNOWN";
            logger.info(`Transaction failed ${transactionId} (${code})`, {playerId, nativeId, wallet, operator, brand, transaction, error: e});
            serviceMetrics.updateFailedTransactionsCounter(transaction.game!, e.message, wallet, e.data?.error, operator, code, brand);
            await Transaction.failed(transactionId, code);

            if (e instanceof Exception) {
                throw e;
            } else {
                throw new Exception("Transaction failed", {code});
            }
        }
    },
    async balance(playerId: string, provider: string, game: string): Promise<IWalletBalance> {
        const player = await Player.getById(playerId);
        const walletAdapter = await getWalletAdapter(player.wallet);
        const session = await Session.getAndProlong(player.id, provider, game, false, walletAdapter.sessionExpiryMinutes);
        return await walletAdapter.balance(player, provider, game, session);
    },
    async cancel(rgs: string, rgsTransactionId: string, auto: boolean): Promise<IWalletBalance> {
        const transaction = await Transaction.findTransaction(rgs, rgsTransactionId);
        if (!transaction) throw new Exception("Couldn't find transaction to cancel", {code: "TRANSACTION_NOT_FOUND", data: {rgs, rgsTransactionId}});
        if (transaction.type !== "withdraw") throw new Exception("Only withdrawals can be cancelled", {data: {transactionId: transaction.id}});
        if (transaction.status == "cancelled") {
            logger.info(`Transaction already cancelled ${transaction.id}`, {transaction});
            return {balance: transaction.balanceAfter};
        }
        if (await Transaction.findOneBy({roundId: transaction?.roundId, type: "deposit"})) throw new Exception("Cannot cancel transaction after sending deposit");
        await Transaction.cancel(transaction.id);

        const player = await Player.getById(transaction.playerId);
        const {wallet, nativeId, operator, brand, currency, jurisdiction} = player;
        const walletAdapter = await getWalletAdapter(wallet);

        logger.info(`Canceling transaction ${transaction.id}`, {wallet, operator, brand, nativeId, transactionId: transaction.id});
        try {
            await sendToPromo("cancel", transaction.category, {transactionId: transaction.id, ...transaction, nativeId, wallet, operator, brand, currency, jurisdiction});
            const session = await Session.getAndProlong(player.id, transaction.provider, transaction.game, !auto, walletAdapter.sessionExpiryMinutes);
            const originalSession = transaction?.sessionId ? await Session.get(transaction.sessionId) : null;
            const {balance} = await executeInQueue(
                await getParallelTransactionId(wallet, transaction.playerId),
                async () => await walletAdapter.cancel(player, {transactionId: transaction.id, ...transaction} as IWalletTransaction, session, originalSession),
                20,
                60000,
            );
            logger.info(`Transaction cancelled ${transaction.id}`, {balance, wallet, operator, brand, nativeId, transactionId: transaction.id});
            await Transaction.cancelled(transaction.id);
            futureAnthem.cancel(transaction.id);
            return {balance};
        } catch (e: any) {
            logger.info(`Transaction cancel failed ${transaction.id} (${(e as Error).message})`, {wallet, operator, brand, transaction, auto, error: e});
            serviceMetrics.updateFailedTransactionsCounter(transaction.game!, e.message, wallet, e.data?.error, operator, e.code, brand);
            throw e;
        }
    },
    async message(playerId: string, provider: string, game: string, data: any) {
        const player = await Player.getById(playerId);
        const walletAdapter = await getWalletAdapter(player.wallet);
        if (!walletAdapter.message) {
            throw new Exception(`Wallet ${player.wallet} doesn't support messages`);
        }
        const session = await Session.getAndProlong(player.id, provider, game, true, walletAdapter.sessionExpiryMinutes);
        return await walletAdapter.message(player, data, session);
    },
    async endActiveSession(reason: "expired" | "error", sessionId: string) {
        const session = await Session.findOneBy({sessionId, active: true});
        if (!session) {
            await unsheduleTask("endSession", sessionId);
            return;
        }

        try {
            const player = await Player.findOneByOrFail({id: session.playerId});
            const walletAdapter = await getWalletAdapter(player.wallet);
            if (walletAdapter.end) await walletAdapter.end(player, reason, session);
            await Session.update({sessionId}, {active: false, endedAt: new Date()});
            await unsheduleTask("endSession", sessionId);
        } catch (e) {
            logger.warn("Couldn't end player session", {session, error: e});
            await scheduleTask("endSession", sessionId, Date.now() + 60 * 1000, {sessionId});
        }
    },
};

async function getParallelTransactionId(walletId: string, playerId: string): Promise<string | false> {
    if ((await Wallet.getWallets()).find(wallet => wallet.id === walletId)?.parallelTransactions) {
        return false;
    }
    return `wallet-request:${playerId}`;
}
